/**
 * Cookie-less session derivation for engagement instrumentation.
 *
 * A "session" here is the tuple (client IP, user agent, 30-min wall-clock
 * bucket). Two requests within the same 30-min window from the same client
 * collapse to the same session_id; either the bucket rolling over or a
 * change in client identity produces a new one.
 *
 * The session_id is a SHA-256 hash. To prevent cross-day correlation of
 * sessions and to avoid storing anything that could be reversed back to a
 * stable client identifier, we mix in a daily-rotated salt held in KV under
 * `__engagement_salt__:YYYY-MM-DD`. Salts are generated on first read each
 * day and are random per day, so historical session_ids cannot be tied back
 * to a specific user once the salt has rotated out of cache.
 *
 * Privacy posture: no IP, no UA, and no cookie value is ever written to
 * storage in plaintext. Only the one-way hash is persisted (and only as part
 * of aggregate rollups).
 */

const SESSION_BUCKET_MS = 30 * 60 * 1000;
const SALT_KV_PREFIX = '__engagement_salt__:';
// 14 days is enough for the longest backfill window we'd run; older salts
// are GC'd by KV's natural eviction.
const SALT_TTL_SECONDS = 14 * 24 * 60 * 60;

export interface SessionInputs {
  ip: string;
  userAgent: string;
  /** Epoch milliseconds. */
  now: number;
  /** UTC date string of `now`, format YYYY-MM-DD. Pass-through for KV salt key. */
  utcDate: string;
}

/**
 * Compute the 30-min bucket index for a timestamp. Used as a stable
 * sub-component of the session id so the id stays constant for the duration
 * of a bucket and rolls naturally on bucket boundaries.
 */
export function bucketIndex(now: number): number {
  return Math.floor(now / SESSION_BUCKET_MS);
}

/**
 * Format the UTC YYYY-MM-DD that contains the given timestamp. Stable across
 * timezones because all rollups operate on UTC.
 */
export function utcDateOf(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Read the daily-rotated salt from KV, generating and persisting one if it
 * doesn't yet exist. Must be awaited before computing a session id.
 *
 * Generated salts are 32 random bytes encoded as hex. KV reads are ~ms; we
 * pay this cost on every page-view event, which is acceptable for
 * fire-and-forget telemetry but means the caller must `ctx.waitUntil()` the
 * write so the response path stays unblocked.
 */
export async function getOrCreateDailySalt(
  kv: KVNamespace,
  utcDate: string
): Promise<string> {
  const key = `${SALT_KV_PREFIX}${utcDate}`;
  const existing = await kv.get(key, 'text');
  if (existing) {
    return existing;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const salt = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  // Best-effort write; if a parallel request beat us to it the second writer
  // overwrites with its own salt, which means a few requests near the
  // race-condition boundary may produce a different session id than they
  // otherwise would. Acceptable noise.
  await kv.put(key, salt, { expirationTtl: SALT_TTL_SECONDS });
  return salt;
}

/**
 * Compute a session id from the inputs. Pure function: identical inputs
 * always produce the same id. The salt is the only secret material; with it
 * rotated daily, ids cannot be correlated across days.
 */
export async function computeSessionId(
  inputs: SessionInputs,
  salt: string
): Promise<string> {
  const bucket = bucketIndex(inputs.now);
  // Pipe-delimit because IPs and UAs do not contain '|'; concatenation
  // without a delimiter could let a crafted UA collide with a different IP.
  const material = `${inputs.ip}|${inputs.userAgent}|${bucket}|${salt}`;
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive a session id for a request. Convenience over the lower-level
 * primitives above. Returns null only if the KV salt fetch fails — callers
 * should treat null as "skip this event."
 */
export async function deriveSessionId(
  request: Request,
  kv: KVNamespace,
  now: number = Date.now()
): Promise<string | null> {
  try {
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
      'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const utcDate = utcDateOf(now);
    const salt = await getOrCreateDailySalt(kv, utcDate);
    return await computeSessionId({ ip, userAgent, now, utcDate }, salt);
  } catch {
    return null;
  }
}
