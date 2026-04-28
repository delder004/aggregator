import { describe, expect, it } from 'vitest';
import {
  aggregatePaths,
  aggregateSessions,
  buildEngagementRollupQuery,
  type RawEngagementEvent,
} from './engagement-rollup';

function ev(over: Partial<RawEngagementEvent>): RawEngagementEvent {
  return {
    ts: '2026-04-27T14:05:00Z',
    event_date: '2026-04-27',
    event_type: 'page_view',
    path: '/',
    session_id: 's1',
    referrer: 'direct',
    country: 'US',
    conversion_type: '',
    sample_interval: 1,
    ...over,
  };
}

describe('aggregateSessions', () => {
  it('returns no rows for empty input', () => {
    expect(aggregateSessions([])).toEqual([]);
  });

  it('treats a single page-view as a bounce', () => {
    const rows = aggregateSessions([ev({})]);
    expect(rows).toHaveLength(1);
    expect(rows[0].page_count).toBe(1);
    expect(rows[0].bounced).toBe(1);
    expect(rows[0].converted).toBe(0);
    expect(rows[0].first_path).toBe('/');
    expect(rows[0].last_path).toBe('/');
    expect(rows[0].duration_seconds).toBe(0);
  });

  it('marks multi-page sessions as not bounced and tracks first/last/duration', () => {
    const rows = aggregateSessions([
      ev({ ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ ts: '2026-04-27T14:01:30Z', path: '/companies' }),
      ev({ ts: '2026-04-27T14:03:15Z', path: '/article/abc' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].page_count).toBe(3);
    expect(rows[0].bounced).toBe(0);
    expect(rows[0].first_path).toBe('/');
    expect(rows[0].last_path).toBe('/article/abc');
    expect(rows[0].duration_seconds).toBe(195); // 3 min 15 sec
  });

  it('marks a session as converted when a conversion event is present', () => {
    const rows = aggregateSessions([
      ev({ ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({
        ts: '2026-04-27T14:02:00Z',
        path: '/subscribe',
        event_type: 'conversion',
        conversion_type: 'newsletter',
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].converted).toBe(1);
    expect(rows[0].bounced).toBe(0); // single-page-view + conversion is NOT a bounce
  });

  it('groups events by session_id correctly', () => {
    const rows = aggregateSessions([
      ev({ session_id: 's1', path: '/' }),
      ev({ session_id: 's2', path: '/jobs' }),
      ev({ session_id: 's1', ts: '2026-04-27T14:01:00Z', path: '/companies' }),
    ]);
    expect(rows).toHaveLength(2);
    const s1 = rows.find((r) => r.session_id === 's1')!;
    const s2 = rows.find((r) => r.session_id === 's2')!;
    expect(s1.page_count).toBe(2);
    expect(s2.page_count).toBe(1);
  });

  it('sorts events within a session by timestamp regardless of input order', () => {
    const rows = aggregateSessions([
      ev({ ts: '2026-04-27T14:05:00Z', path: '/companies' }),
      ev({ ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ ts: '2026-04-27T14:10:00Z', path: '/article/abc' }),
    ]);
    expect(rows[0].first_path).toBe('/');
    expect(rows[0].last_path).toBe('/article/abc');
  });
});

describe('aggregatePaths', () => {
  it('returns no rows for empty input', () => {
    expect(aggregatePaths([], [])).toEqual([]);
  });

  it('counts views, unique sessions, entries, exits per path', () => {
    const events = [
      ev({ session_id: 's1', ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ session_id: 's1', ts: '2026-04-27T14:01:00Z', path: '/jobs' }),
      ev({ session_id: 's2', ts: '2026-04-27T14:02:00Z', path: '/' }),
      ev({ session_id: 's2', ts: '2026-04-27T14:03:00Z', path: '/companies' }),
    ];
    const sessions = aggregateSessions(events);
    const paths = aggregatePaths(events, sessions);
    const home = paths.find((p) => p.path === '/')!;
    const jobs = paths.find((p) => p.path === '/jobs')!;
    const companies = paths.find((p) => p.path === '/companies')!;

    expect(home.views).toBe(2);
    expect(home.unique_sessions).toBe(2);
    expect(home.entries).toBe(2);
    expect(home.exits).toBe(0);
    expect(home.bounces).toBe(0);

    expect(jobs.exits).toBe(1);
    expect(jobs.entries).toBe(0);
    expect(companies.exits).toBe(1);
  });

  it('attributes a bounce to the entry path of a single-view session', () => {
    const events = [
      ev({ session_id: 's1', path: '/companies' }),
    ];
    const sessions = aggregateSessions(events);
    const paths = aggregatePaths(events, sessions);
    const companies = paths.find((p) => p.path === '/companies')!;
    expect(companies.bounces).toBe(1);
    expect(companies.entries).toBe(1);
    expect(companies.exits).toBe(1);
  });

  it('credits conversions to every path the converting session touched', () => {
    const events = [
      ev({ session_id: 's1', ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ session_id: 's1', ts: '2026-04-27T14:01:00Z', path: '/article/abc' }),
      ev({
        session_id: 's1',
        ts: '2026-04-27T14:02:00Z',
        path: '/subscribe',
        event_type: 'conversion',
        conversion_type: 'newsletter',
      }),
    ];
    const sessions = aggregateSessions(events);
    const paths = aggregatePaths(events, sessions);
    expect(paths.find((p) => p.path === '/')!.conversions).toBe(1);
    expect(paths.find((p) => p.path === '/article/abc')!.conversions).toBe(1);
    // /subscribe was a conversion event, not a page view, so no path row for it.
    expect(paths.find((p) => p.path === '/subscribe')).toBeUndefined();
  });

  it('computes the most-common next path per source path', () => {
    const events = [
      // s1: / -> /jobs
      ev({ session_id: 's1', ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ session_id: 's1', ts: '2026-04-27T14:01:00Z', path: '/jobs' }),
      // s2: / -> /companies
      ev({ session_id: 's2', ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ session_id: 's2', ts: '2026-04-27T14:01:00Z', path: '/companies' }),
      // s3: / -> /companies
      ev({ session_id: 's3', ts: '2026-04-27T14:00:00Z', path: '/' }),
      ev({ session_id: 's3', ts: '2026-04-27T14:01:00Z', path: '/companies' }),
    ];
    const sessions = aggregateSessions(events);
    const paths = aggregatePaths(events, sessions);
    const home = paths.find((p) => p.path === '/')!;
    expect(home.next_path_top).toBe('/companies');
  });

  it('weights view counts by AE sample_interval', () => {
    const events = [
      ev({ session_id: 's1', path: '/', sample_interval: 5 }),
    ];
    const sessions = aggregateSessions(events);
    const paths = aggregatePaths(events, sessions);
    expect(paths.find((p) => p.path === '/')!.views).toBe(5);
  });
});

describe('buildEngagementRollupQuery', () => {
  it('produces a half-open window [from, to) and selects expected fields', () => {
    const sql = buildEngagementRollupQuery('2026-04-20', '2026-04-27');
    expect(sql).toContain("toDateTime('2026-04-20 00:00:00')");
    expect(sql).toContain("toDateTime('2026-04-27 00:00:00')");
    expect(sql).toContain('blob1 AS event_type');
    expect(sql).toContain('blob3 AS session_id');
    expect(sql).toContain('blob7 AS conversion_type');
  });

  it('filters bots by user-agent (blob6)', () => {
    const sql = buildEngagementRollupQuery('2026-04-20', '2026-04-27');
    expect(sql).toContain("lower(blob6) NOT LIKE '%bot%'");
    expect(sql).toContain("lower(blob6) NOT LIKE '%crawl%'");
  });

  it('orders by session_id then ts so aggregateSessions can stream-group', () => {
    const sql = buildEngagementRollupQuery('2026-04-20', '2026-04-27');
    expect(sql).toContain('ORDER BY session_id ASC, ts ASC');
  });
});
