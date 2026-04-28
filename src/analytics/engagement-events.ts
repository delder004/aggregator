/**
 * Engagement event writers.
 *
 * Writes to a separate Analytics Engine dataset (AE_ENGAGEMENT) so the blob
 * layout can carry session_id, path, and event_type without conflicting
 * with the existing article-view dataset (AE_EVENTS) and its rollup query.
 *
 * Blob layout (must stay stable — the rollup SQL references positions):
 *   blob1 = event_type ('page_view' | 'conversion')
 *   blob2 = path (URL pathname, no query string)
 *   blob3 = session_id (sha256 hex)
 *   blob4 = referrer host or 'direct'
 *   blob5 = country (cf.country) or 'unknown'
 *   blob6 = user-agent (truncated; used for bot filter)
 *   blob7 = conversion_type (only set on conversion events; 'newsletter' for now)
 *
 * indexes[0] = session_id — used by the SQL API for cheap session-keyed scans.
 */
import type { Env } from '../types';

const PATH_MAX = 256;
const REFERRER_MAX = 256;
const UA_MAX = 256;

export type EngagementEventType = 'page_view' | 'conversion';
export type ConversionType = 'newsletter';

export interface PageViewEventInput {
  sessionId: string;
  path: string;
  referrer: string | null;
  country: string | null;
  userAgent: string | null;
}

export interface ConversionEventInput {
  sessionId: string;
  conversionType: ConversionType;
  path: string;
  country: string | null;
  userAgent: string | null;
}

/**
 * Best-effort write of a page-view event. Never throws; never blocks the
 * response. Caller should already have a session id (or skip the event if
 * derivation failed).
 */
export function writePageViewEvent(
  env: Env,
  input: PageViewEventInput
): void {
  if (!env.AE_ENGAGEMENT) {
    return;
  }
  try {
    env.AE_ENGAGEMENT.writeDataPoint({
      blobs: [
        'page_view',
        input.path.slice(0, PATH_MAX),
        input.sessionId,
        normalizeReferer(input.referrer),
        input.country || 'unknown',
        (input.userAgent || '').slice(0, UA_MAX),
        '',
      ],
      doubles: [1],
      indexes: [input.sessionId],
    });
  } catch {
    // best-effort; never affect response serving
  }
}

/**
 * Best-effort write of a conversion event (currently: newsletter signup).
 * The session_id ties the conversion back to the landing-page session for
 * attribution.
 */
export function writeConversionEvent(
  env: Env,
  input: ConversionEventInput
): void {
  if (!env.AE_ENGAGEMENT) {
    return;
  }
  try {
    env.AE_ENGAGEMENT.writeDataPoint({
      blobs: [
        'conversion',
        input.path.slice(0, PATH_MAX),
        input.sessionId,
        'direct',
        input.country || 'unknown',
        (input.userAgent || '').slice(0, UA_MAX),
        input.conversionType,
      ],
      doubles: [1],
      indexes: [input.sessionId],
    });
  } catch {
    // best-effort
  }
}

function normalizeReferer(referer: string | null): string {
  if (!referer) {
    return 'direct';
  }
  try {
    const parsed = new URL(referer);
    return parsed.host.slice(0, REFERRER_MAX);
  } catch {
    return referer.slice(0, REFERRER_MAX);
  }
}
