import type { Env } from './types';
import { searchArticles, getArticleById, getRelatedArticles } from './db/queries';
import { layout, articleCard, escapeHtml } from './renderer/html';

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

    // Dynamic search page
    if (path === '/search') {
      const q = url.searchParams.get('q')?.trim() || '';

      let body = '';
      if (q) {
        const results = await searchArticles(env.DB, q);
        body += `<div class="section-label">Search results for "${escapeHtml(q)}"</div>\n`;
        if (results.length > 0) {
          body += results.map(a => articleCard(a)).join('\n');
        } else {
          body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles found for "${escapeHtml(q)}". Try a different search.</p>`;
        }
      } else {
        body += `<div class="section-label">Search</div>\n`;
        body += `<p style="color:var(--text-secondary);padding:1rem 0;">Enter a search term above to find articles.</p>`;
      }

      const html = layout(body, {
        title: q ? `Search: ${q}` : 'Search',
        description: 'Search articles about AI in accounting.',
        path: '/search',
        searchQuery: q,
      });

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    // Dynamic article detail page
    const articleMatch = path.match(/^\/article\/([a-f0-9-]+)$/);
    if (articleMatch) {
      const articleId = articleMatch[1];
      const article = await getArticleById(env.DB, articleId);

      if (!article) {
        return new Response('Not Found', { status: 404 });
      }

      const related = await getRelatedArticles(env.DB, article);

      // Build article detail body
      const title = escapeHtml(article.headline || article.title);
      const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';

      let detailBody = `<div class="article-detail">`;
      detailBody += `<h1>${title}</h1>`;
      detailBody += `<div class="article-meta">`;
      detailBody += `<span class="source-name">${escapeHtml(article.sourceName)}</span>`;
      if (article.author) {
        detailBody += ` <span class="meta-dot">&middot;</span> ${escapeHtml(article.author)}`;
      }
      detailBody += ` <span class="meta-dot">&middot;</span> <time datetime="${article.publishedAt}">${new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>`;
      if (article.relevanceScore) {
        detailBody += ` <span class="meta-dot">&middot;</span> Relevance: ${article.relevanceScore}/100`;
      }
      detailBody += `</div>`;

      if (summary) {
        detailBody += `<p class="article-summary">${summary}</p>`;
      }

      if (article.tags.length > 0) {
        detailBody += `<div class="article-tags">${article.tags.map(t => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`).join('')}</div>`;
      }

      if (article.companyMentions.length > 0) {
        detailBody += `<div class="article-tags">${article.companyMentions.map(c => `<a class="company-tag" href="/companies">${escapeHtml(c)}</a>`).join('')}</div>`;
      }

      detailBody += `<a class="original-link" href="${escapeHtml(article.url)}" rel="noopener" target="_blank">Read original article &rarr;</a>`;
      detailBody += `</div>`;

      // Related articles
      if (related.length > 0) {
        detailBody += `<div class="related-section">`;
        detailBody += `<div class="section-label">Related Articles</div>`;
        detailBody += related.map(a => articleCard(a)).join('\n');
        detailBody += `</div>`;
      }

      const html = layout(detailBody, {
        title: article.headline || article.title,
        description: article.aiSummary || `Article about ${article.title}`,
        path: `/article/${articleId}`,
      });

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
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
