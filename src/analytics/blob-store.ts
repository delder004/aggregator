/**
 * KV-backed blob store for large snapshot payloads. D1 keeps queryable
 * metadata only; raw bodies go here under a deterministic namespace key.
 *
 * Key shape: `<namespace>/<windowStart>/<id>.json`
 *
 * windowStart in the path keeps blobs grouped by week and makes manual
 * cleanup of an old window straightforward (`KV list prefix`).
 */

export interface BlobWriteResult {
  key: string;
  bytes: number;
}

export async function writeBlob(
  kv: KVNamespace,
  namespace: string,
  windowStart: string,
  id: string,
  data: unknown
): Promise<BlobWriteResult> {
  const key = blobKey(namespace, windowStart, id);
  const body = JSON.stringify(data);
  await kv.put(key, body);
  return { key, bytes: body.length };
}

export async function readBlob<T = unknown>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const body = await kv.get(key, 'text');
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export function blobKey(namespace: string, windowStart: string, id: string): string {
  return `${namespace}/${windowStart}/${id}.json`;
}
