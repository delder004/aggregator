/**
 * Engagement rollup. Queries the AE_ENGAGEMENT dataset for raw page-view
 * and conversion events in a complete-UTC-day window, derives per-session
 * facts, and aggregates those into per-path daily summaries.
 *
 * Schema for the two output tables lives in
 * src/db/migration-033-engagement.sql. Re-running the rollup for the same
 * window is safe: both tables use ON CONFLICT DO UPDATE to overwrite.
 *
 * The aggregation logic is split into pure functions
 * (`aggregateSessions`, `aggregatePaths`) so it can be tested without
 * mocking AE or D1.
 */
import type { Env } from '../types';
import { ENGAGEMENT_ROLLUP_BUDGET } from './budgets';
import { resolveRollupWindow, type RollupOptions } from './analytics-engine';

const AE_DATASET = 'agenticaiaccounting_engagement';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One row from the AE SQL fetch. Field names match the SELECT aliases. */
export interface RawEngagementEvent {
  /** ISO timestamp from AE (formatted by the SQL alias). */
  ts: string;
  /** UTC date YYYY-MM-DD, derived in the SQL via formatDateTime. */
  event_date: string;
  event_type: 'page_view' | 'conversion';
  path: string;
  session_id: string;
  referrer: string;
  country: string;
  conversion_type: string;
  /** AE sample interval — multiply count-style aggregates by this. */
  sample_interval: number;
}

export interface SessionRow {
  session_date: string;
  session_id: string;
  page_count: number;
  first_path: string;
  last_path: string;
  first_referrer: string | null;
  duration_seconds: number;
  bounced: number;
  converted: number;
  country: string | null;
}

export interface PathRow {
  view_date: string;
  path: string;
  views: number;
  unique_sessions: number;
  entries: number;
  exits: number;
  bounces: number;
  conversions: number;
  next_path_top: string | null;
}

export interface EngagementRollupResult {
  rowsScanned: number;
  sessionsWritten: number;
  pathsWritten: number;
  fromDate: string;
  toDate: string;
  rowsBeforeLimit: number | null;
  query: string;
}

// ---------------------------------------------------------------------------
// Pure aggregation
// ---------------------------------------------------------------------------

/**
 * Group events by session_id and derive per-session facts.
 *
 * Inputs are expected to be sorted by (session_id, ts). The SQL ORDER BY
 * provides this; the function tolerates unsorted input by re-sorting per
 * session, at a small cost.
 *
 * A session "bounces" if it has exactly one page-view event and no
 * conversion event. A session "converts" if any conversion event is
 * attached to the same session_id, regardless of order.
 */
export function aggregateSessions(
  events: RawEngagementEvent[]
): SessionRow[] {
  const bySession = new Map<string, RawEngagementEvent[]>();
  for (const e of events) {
    if (!e.session_id) continue;
    const arr = bySession.get(e.session_id) ?? [];
    arr.push(e);
    bySession.set(e.session_id, arr);
  }

  const rows: SessionRow[] = [];
  for (const [sessionId, evs] of bySession) {
    evs.sort((a, b) => a.ts.localeCompare(b.ts));
    const pageViews = evs.filter((e) => e.event_type === 'page_view');
    const conversions = evs.filter((e) => e.event_type === 'conversion');

    if (pageViews.length === 0 && conversions.length === 0) continue;

    // For session_date and country attribution, prefer the first page view;
    // fall back to first event of any type if no page views exist.
    const anchor = pageViews[0] ?? evs[0];
    const last = pageViews[pageViews.length - 1] ?? anchor;
    const firstReferrer = anchor.referrer || null;

    const startMs = new Date(anchor.ts).getTime();
    const endMs = new Date(last.ts).getTime();
    const durationSeconds = Math.max(
      0,
      Math.floor((endMs - startMs) / 1000)
    );

    const pageCount = pageViews.length;
    const converted = conversions.length > 0 ? 1 : 0;
    const bounced = pageCount === 1 && converted === 0 ? 1 : 0;

    rows.push({
      session_date: anchor.event_date,
      session_id: sessionId,
      page_count: pageCount,
      first_path: anchor.path,
      last_path: last.path,
      first_referrer: firstReferrer,
      duration_seconds: durationSeconds,
      bounced,
      converted,
      country: anchor.country || null,
    });
  }

  return rows;
}

/**
 * Aggregate sessions into per-path daily summaries. Operates on the same
 * raw events to enable per-path view/next-path counts; the session rows
 * carry per-session facts (entries, exits, bounces, conversions).
 */
export function aggregatePaths(
  events: RawEngagementEvent[],
  sessions: SessionRow[]
): PathRow[] {
  // Re-derive per-session ordered page-view paths so we can count
  // (path -> next_path) transitions.
  const sessionPaths = new Map<string, string[]>();
  const sessionDates = new Map<string, string>();
  for (const e of events) {
    if (e.event_type !== 'page_view' || !e.session_id) continue;
    const arr = sessionPaths.get(e.session_id) ?? [];
    arr.push(e.path);
    sessionPaths.set(e.session_id, arr);
    if (!sessionDates.has(e.session_id)) {
      sessionDates.set(e.session_id, e.event_date);
    }
  }

  // Per-(date, path) counters.
  interface PathBuckets {
    views: number;
    sessions: Set<string>;
    entries: number;
    exits: number;
    bounces: number;
    conversions: number;
    nextPathCounts: Map<string, number>;
  }
  const buckets = new Map<string, PathBuckets>();
  const keyOf = (date: string, path: string) => `${date}|${path}`;
  const get = (date: string, path: string): PathBuckets => {
    const k = keyOf(date, path);
    let b = buckets.get(k);
    if (!b) {
      b = {
        views: 0,
        sessions: new Set(),
        entries: 0,
        exits: 0,
        bounces: 0,
        conversions: 0,
        nextPathCounts: new Map(),
      };
      buckets.set(k, b);
    }
    return b;
  };

  // Views and unique-session counts per (date, path) come from raw events.
  for (const e of events) {
    if (e.event_type !== 'page_view') continue;
    const b = get(e.event_date, e.path);
    b.views += Math.max(1, Math.round(e.sample_interval || 1));
    b.sessions.add(e.session_id);
  }

  // Per-session derived counters (entries, exits, bounces, conversions,
  // next-path transitions).
  const sessionByid = new Map<string, SessionRow>();
  for (const s of sessions) sessionByid.set(s.session_id, s);

  for (const [sessionId, paths] of sessionPaths) {
    const sess = sessionByid.get(sessionId);
    if (!sess || paths.length === 0) continue;
    const date = sess.session_date;

    // Entries = first path in the ordered list.
    const first = paths[0];
    get(date, first).entries += 1;
    // Exits = last path.
    const last = paths[paths.length - 1];
    get(date, last).exits += 1;
    // Bounces = single-page session, attributed to the entry path.
    if (sess.bounced) get(date, first).bounces += 1;
    // Conversions credit every path the converting session touched.
    if (sess.converted) {
      const distinct = new Set(paths);
      for (const p of distinct) get(date, p).conversions += 1;
    }
    // Next-path transitions.
    for (let i = 0; i < paths.length - 1; i++) {
      const cur = paths[i];
      const next = paths[i + 1];
      const b = get(date, cur);
      b.nextPathCounts.set(next, (b.nextPathCounts.get(next) ?? 0) + 1);
    }
  }

  const rows: PathRow[] = [];
  for (const [k, b] of buckets) {
    const [view_date, path] = k.split('|', 2);
    let nextPathTop: string | null = null;
    let bestCount = 0;
    for (const [p, n] of b.nextPathCounts) {
      if (n > bestCount) {
        nextPathTop = p;
        bestCount = n;
      }
    }
    rows.push({
      view_date,
      path,
      views: b.views,
      unique_sessions: b.sessions.size,
      entries: b.entries,
      exits: b.exits,
      bounces: b.bounces,
      conversions: b.conversions,
      next_path_top: nextPathTop,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

/**
 * Build the AE SQL query that fetches raw events for the rollup. Bounds are
 * half-open: [fromDate 00:00 UTC, toDate 00:00 UTC).
 */
export function buildEngagementRollupQuery(
  fromDate: string,
  toDate: string
): string {
  return [
    'SELECT',
    "  formatDateTime(timestamp, '%Y-%m-%dT%H:%M:%SZ') AS ts,",
    "  formatDateTime(timestamp, '%Y-%m-%d') AS event_date,",
    '  blob1 AS event_type,',
    '  blob2 AS path,',
    '  blob3 AS session_id,',
    '  blob4 AS referrer,',
    '  blob5 AS country,',
    '  blob7 AS conversion_type,',
    '  _sample_interval AS sample_interval',
    `FROM ${AE_DATASET}`,
    `WHERE timestamp >= toDateTime('${fromDate} 00:00:00')`,
    `  AND timestamp < toDateTime('${toDate} 00:00:00')`,
    "  AND lower(blob6) NOT LIKE '%bot%'",
    "  AND lower(blob6) NOT LIKE '%crawl%'",
    "  AND lower(blob6) NOT LIKE '%spider%'",
    "  AND lower(blob6) NOT LIKE '%scrape%'",
    'ORDER BY session_id ASC, ts ASC',
    `LIMIT ${ENGAGEMENT_ROLLUP_BUDGET.rollupRowLimit}`,
  ].join('\n');
}

interface AeSqlResponse<T> {
  data?: T[];
  rows?: number;
  rows_before_limit_at_least?: number;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runEngagementRollup(
  env: Env,
  options: RollupOptions = {}
): Promise<EngagementRollupResult> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_API_TOKEN) {
    throw new Error(
      'CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN are required for the engagement rollup'
    );
  }

  const { fromDate, toDate } = resolveRollupWindow(new Date(), options);
  const query = buildEngagementRollupQuery(fromDate, toDate);
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ENGAGEMENT_ROLLUP_BUDGET.rollupTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_ANALYTICS_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: query,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AE SQL ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as AeSqlResponse<RawEngagementEvent>;
  const rows = Array.isArray(data.data) ? data.data : [];
  const rowsBeforeLimit =
    typeof data.rows_before_limit_at_least === 'number'
      ? data.rows_before_limit_at_least
      : null;

  if (rowsBeforeLimit !== null && rowsBeforeLimit > rows.length) {
    throw new Error(
      `Engagement rollup hit the row limit: returned ${rows.length}, ` +
        `available >= ${rowsBeforeLimit}. Increase ` +
        `ENGAGEMENT_ROLLUP_BUDGET.rollupRowLimit or narrow the window.`
    );
  }

  // Coerce numeric-strings (AE returns sample_interval as number-or-string
  // depending on type inference). Normalize defensively.
  const normalized: RawEngagementEvent[] = rows.map((r) => ({
    ...r,
    sample_interval: Number(r.sample_interval) || 1,
  }));

  const sessions = aggregateSessions(normalized);
  const paths = aggregatePaths(normalized, sessions);

  // D1 batched upserts.
  if (sessions.length > 0) {
    const stmts = sessions.map((s) =>
      env.DB.prepare(
        `INSERT INTO engagement_sessions_daily (
           session_date, session_id, page_count, first_path, last_path,
           first_referrer, duration_seconds, bounced, converted, country
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_date, session_id) DO UPDATE SET
           page_count = excluded.page_count,
           first_path = excluded.first_path,
           last_path = excluded.last_path,
           first_referrer = excluded.first_referrer,
           duration_seconds = excluded.duration_seconds,
           bounced = excluded.bounced,
           converted = excluded.converted,
           country = excluded.country`
      ).bind(
        s.session_date,
        s.session_id,
        s.page_count,
        s.first_path,
        s.last_path,
        s.first_referrer,
        s.duration_seconds,
        s.bounced,
        s.converted,
        s.country
      )
    );
    for (let i = 0; i < stmts.length; i += 50) {
      await env.DB.batch(stmts.slice(i, i + 50));
    }
  }

  if (paths.length > 0) {
    const stmts = paths.map((p) =>
      env.DB.prepare(
        `INSERT INTO engagement_path_daily (
           view_date, path, views, unique_sessions, entries, exits,
           bounces, conversions, next_path_top
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (view_date, path) DO UPDATE SET
           views = excluded.views,
           unique_sessions = excluded.unique_sessions,
           entries = excluded.entries,
           exits = excluded.exits,
           bounces = excluded.bounces,
           conversions = excluded.conversions,
           next_path_top = excluded.next_path_top`
      ).bind(
        p.view_date,
        p.path,
        p.views,
        p.unique_sessions,
        p.entries,
        p.exits,
        p.bounces,
        p.conversions,
        p.next_path_top
      )
    );
    for (let i = 0; i < stmts.length; i += 50) {
      await env.DB.batch(stmts.slice(i, i + 50));
    }
  }

  return {
    rowsScanned: rows.length,
    sessionsWritten: sessions.length,
    pathsWritten: paths.length,
    fromDate,
    toDate,
    rowsBeforeLimit,
    query,
  };
}
