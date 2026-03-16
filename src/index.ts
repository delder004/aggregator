import type { Env } from './types';

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve pre-rendered HTML from KV
    const cached = await env.KV.get(path, 'text');
    if (cached) {
      const contentType = path.endsWith('.xml')
        ? 'application/xml'
        : 'text/html';
      return new Response(cached, {
        headers: { 'Content-Type': `${contentType}; charset=utf-8` },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Phase 3 will wire up the full pipeline:
    // 1. Fetch from all collectors
    // 2. Deduplicate by URL
    // 3. Score with Claude Haiku
    // 4. Store in D1
    // 5. Regenerate HTML pages
    // 6. Write to KV
    console.log('Cron job triggered');
  },
};
