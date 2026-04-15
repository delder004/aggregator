import type { Env } from '../types';
import { ANALYTICS_ENGINE_BUDGET } from './budgets';

const AE_DATASET = 'agenticaiaccounting_article_views';

export interface ArticleViewEventInput {
  articleId: string;
  referer: string | null;
  country: string | null;
  userAgent: string | null;
}

/**
 * Best-effort write to Analytics Engine. Never throws and never blocks the
 * fetch() response path. writeDataPoint is sync-enqueue per the Cloudflare
 * docs, so no await is needed and any error here is swallowed.
 *
 * Blob layout (must stay stable — the rollup SQL references positions):
 *   blob1 = articleId
 *   blob2 = referer host or 'direct'
 *   blob3 = country (cf.country) or 'unknown'
 *   blob4 = user-agent (truncated to 256 chars)
 *
 * indexes[0] = articleId — used by the SQL API for cheap article-keyed scans.
 */
export function writeArticleViewEvent(
  env: Env,
  input: ArticleViewEventInput
): void {
  if (!env.AE_EVENTS) {
    return;
  }
  try {
    env.AE_EVENTS.writeDataPoint({
      blobs: [
        input.articleId,
        normalizeReferer(input.referer),
        input.country || 'unknown',
        (input.userAgent || '').slice(0, 256),
      ],
      doubles: [1],
      indexes: [input.articleId],
    });
  } catch {
    // best-effort; never affect response serving
  }
}

function normalizeReferer(referer: string | null): string {
  if (!referer) {
    return 'direct';
  }
  try {
    const parsed = new URL(referer);
    return parsed.host.slice(0, 256);
  } catch {
    return referer.slice(0, 256);
  }
}

export interface RollupOptions {
  /** Inclusive lower bound (YYYY-MM-DD UTC). Defaults to toDate - days. */
  fromDate?: string;
  /** Exclusive upper bound (YYYY-MM-DD UTC). Defaults to today UTC midnight. */
  toDate?: string;
  /** Days back from toDate. Default 7. Ignored if fromDate is set. */
  days?: number;
}

export interface ResolvedRollupWindow {
  fromDate: string;
  toDate: string;
}

export interface RollupResult {
  rowsScanned: number;
  rowsWritten: number;
  fromDate: string;
  toDate: string;
  rowsBeforeLimit: number | null;
  query: string;
}

interface AeSqlRow {
  article_id: string;
  view_date: string;
  views: number;
}

interface AeSqlResponse {
  data?: AeSqlRow[];
  rows?: number;
  rows_before_limit_at_least?: number;
}

/**
 * Resolve the rollup window to whole UTC days.
 *
 * Default: [today_midnight - 7 days, today_midnight). Today is excluded
 * because it is still in progress; including it would write a partial-day
 * row that the next run (with the default window) would never overwrite.
 *
 * Throws if toDate is in the future (would write incomplete data) or if the
 * resolved window is empty. The manual trigger endpoint exposes options for
 * explicit backfills.
 */
export function resolveRollupWindow(
  now: Date,
  options: RollupOptions = {}
): ResolvedRollupWindow {
  const todayMidnightDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayMidnight = formatDateUtc(todayMidnightDate);

  let toDate: string;
  if (options.toDate) {
    if (!isValidDateString(options.toDate)) {
      throw new Error(`Rollup toDate must be YYYY-MM-DD, got ${options.toDate}`);
    }
    if (options.toDate > todayMidnight) {
      throw new Error(
        `Rollup toDate ${options.toDate} is in the future. The rollup operates ` +
          `only on complete UTC days; toDate must be <= ${todayMidnight}.`
      );
    }
    toDate = options.toDate;
  } else {
    toDate = todayMidnight;
  }

  let fromDate: string;
  if (options.fromDate) {
    if (!isValidDateString(options.fromDate)) {
      throw new Error(
        `Rollup fromDate must be YYYY-MM-DD, got ${options.fromDate}`
      );
    }
    fromDate = options.fromDate;
  } else {
    const days = options.days ?? 7;
    if (!Number.isInteger(days) || days <= 0) {
      throw new Error(`Rollup days must be a positive integer, got ${days}`);
    }
    const toDateMs = new Date(toDate + 'T00:00:00.000Z').getTime();
    fromDate = formatDateUtc(new Date(toDateMs - days * 86_400_000));
  }

  if (fromDate >= toDate) {
    throw new Error(
      `Rollup window is empty: fromDate=${fromDate}, toDate=${toDate}`
    );
  }

  return { fromDate, toDate };
}

function formatDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  // Parse-and-round-trip: rejects impossible calendar dates like 2026-02-31
  // or 2026-13-01, which the regex accepts but `new Date()` silently
  // normalizes (2026-02-31 → 2026-03-03). Without this check the window
  // SQL would either query the wrong week or be left to the upstream
  // parser to reject.
  const d = new Date(s + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return d.toISOString().slice(0, 10) === s;
}

/**
 * Pull complete-UTC-day article view rows from Analytics Engine via the SQL
 * API and upsert them into article_views.
 *
 * Idempotent: re-running for the same window overwrites with the latest
 * counts via ON CONFLICT DO UPDATE. The rollup intentionally does NOT touch
 * unique_visitors or top_referrer columns — those are reserved for future
 * enrichment passes that need richer aggregations from the same dataset.
 *
 * Throws (before any DB write) if:
 *   - secrets are missing
 *   - the SQL API returns non-2xx
 *   - rows_before_limit_at_least exceeds the returned row count
 *     (silent truncation would lose data)
 */
export async function runArticleViewsRollup(
  env: Env,
  options: RollupOptions = {}
): Promise<RollupResult> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_API_TOKEN) {
    throw new Error(
      'CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN are required for the Analytics Engine rollup'
    );
  }

  const { fromDate, toDate } = resolveRollupWindow(new Date(), options);
  const query = buildRollupQuery(fromDate, toDate);
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ANALYTICS_ENGINE_BUDGET.rollupTimeoutMs
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
      `Analytics Engine SQL API ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as AeSqlResponse;
  const rows = Array.isArray(data.data) ? data.data : [];
  const rowsBeforeLimit =
    typeof data.rows_before_limit_at_least === 'number'
      ? data.rows_before_limit_at_least
      : null;

  // Loud failure on silent truncation. Throws BEFORE any upsert so we never
  // store a partial rollup. Operator must widen the limit or narrow the
  // window and re-run.
  if (rowsBeforeLimit !== null && rowsBeforeLimit > rows.length) {
    throw new Error(
      `Rollup hit the row limit: returned ${rows.length}, ` +
        `available >= ${rowsBeforeLimit}. Increase ` +
        `ANALYTICS_ENGINE_BUDGET.rollupRowLimit or narrow the window.`
    );
  }

  const updatedAt = new Date().toISOString();
  const validRows = rows.filter(
    (row): row is AeSqlRow =>
      typeof row.article_id === 'string' &&
      row.article_id.length > 0 &&
      typeof row.view_date === 'string' &&
      row.view_date.length > 0
  );

  if (validRows.length > 0) {
    const stmts = validRows.map((row) =>
      env.DB.prepare(
        `INSERT INTO article_views (
           article_id, view_date, views, unique_visitors, top_referrer, updated_at
         ) VALUES (?, ?, ?, 0, NULL, ?)
         ON CONFLICT (article_id, view_date) DO UPDATE SET
           views = excluded.views,
           updated_at = excluded.updated_at`
      ).bind(row.article_id, row.view_date, Number(row.views) || 0, updatedAt)
    );
    // D1 batch caps in practice; chunk to be safe.
    for (let i = 0; i < stmts.length; i += 50) {
      await env.DB.batch(stmts.slice(i, i + 50));
    }
  }

  return {
    rowsScanned: rows.length,
    rowsWritten: validRows.length,
    fromDate,
    toDate,
    rowsBeforeLimit,
    query,
  };
}

/**
 * Build the ClickHouse-flavored SQL for the rollup. Extracted so unit tests
 * can assert on the exact query shape — the bot filter, sample-interval
 * weighting, and timestamp formatting are easy to typo and would silently
 * produce wrong rollups.
 *
 * Bounds are half-open: [fromDate 00:00 UTC, toDate 00:00 UTC). Both
 * arguments are YYYY-MM-DD strings already validated by resolveRollupWindow.
 *
 * SUM(_sample_interval) is the documented way to count under Analytics
 * Engine sampling — count() undercounts once sampling kicks in. The two
 * agree exactly when sampling is not active, so this is correct at any
 * scale.
 */
export function buildRollupQuery(fromDate: string, toDate: string): string {
  return [
    'SELECT',
    '  blob1 AS article_id,',
    "  formatDateTime(timestamp, '%Y-%m-%d') AS view_date,",
    '  SUM(_sample_interval) AS views',
    `FROM ${AE_DATASET}`,
    `WHERE timestamp >= toDateTime('${fromDate} 00:00:00')`,
    `  AND timestamp < toDateTime('${toDate} 00:00:00')`,
    "  AND lower(blob4) NOT LIKE '%bot%'",
    "  AND lower(blob4) NOT LIKE '%crawl%'",
    "  AND lower(blob4) NOT LIKE '%spider%'",
    "  AND lower(blob4) NOT LIKE '%scrape%'",
    'GROUP BY article_id, view_date',
    'ORDER BY view_date DESC, views DESC',
    `LIMIT ${ANALYTICS_ENGINE_BUDGET.rollupRowLimit}`,
  ].join('\n');
}
