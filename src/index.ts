import type { Env } from './types';

export { CollectWorkflow, ProcessWorkflow } from './workflow';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize: strip trailing slash except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Manual cron trigger endpoint (authenticated via dedicated secret)
    if (path === '/cron') {
      const cronSecret = env.CRON_SECRET;
      if (!cronSecret || request.headers.get('X-Cron-Key') !== cronSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
      const collectInstance = await env.COLLECT_WORKFLOW.create();
      const processInstance = await env.PROCESS_WORKFLOW.create();
      return new Response(JSON.stringify({
        status: 'started',
        collectInstanceId: collectInstance.id,
        processInstanceId: processInstance.id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Serve pre-rendered pages from KV
    const cached = await env.KV.get(path, 'text');
    if (cached) {
      const isXml = path.endsWith('.xml');
      return new Response(cached, {
        headers: {
          'Content-Type': isXml
            ? 'application/xml; charset=utf-8'
            : 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const collectInstance = await env.COLLECT_WORKFLOW.create();
    const processInstance = await env.PROCESS_WORKFLOW.create();
    console.log(`Collect workflow started: ${collectInstance.id}, Process workflow started: ${processInstance.id}`);
  },
};
