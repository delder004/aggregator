import { describe, expect, it } from 'vitest';
import { addPostHog } from './posthog';

const html = () => new Response('<html><head><title>Test</title></head><body>Hello</body></html>', {
  headers: { 'content-type': 'text/html; charset=utf-8', etag: 'old-content' },
});
describe('PostHog response integration', () => {
  it('adds tracking to cached or dynamically generated production HTML', async () => {
    const response = addPostHog(new Request('https://agenticaiccounting.com/article/example'), html());
    expect(await response.text()).toContain('<script defer src="/site-analytics.js"></script></head>');
    expect(response.headers.has('etag')).toBe(false);
  });
  it.each(['https://localhost/', 'https://preview.workers.dev/', 'https://agenticaiccounting.com/ops/runs'])('excludes non-public pages: %s', async url => {
    expect(await addPostHog(new Request(url), html()).text()).not.toContain('site-analytics');
  });
  it('does not rewrite feeds, errors, or POST responses', () => {
    const request = new Request('https://agenticaiccounting.com/');
    for (const response of [new Response('<rss/>', { headers: { 'content-type': 'application/xml' } }), new Response('error', { status: 500 })]) {
      expect(addPostHog(request, response)).toBe(response);
    }
    const response = html();
    expect(addPostHog(new Request(request, { method: 'POST' }), response)).toBe(response);
  });
});
