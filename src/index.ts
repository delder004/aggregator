import type { Env } from './types';
import { getArticleById, getRelatedArticles } from './db/queries';
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
      let sourceSiteUrl = '';
      try { sourceSiteUrl = new URL(article.url).origin; } catch {}
      detailBody += sourceSiteUrl
        ? `<a href="${escapeHtml(sourceSiteUrl)}" class="source-name" target="_blank" rel="noopener">${escapeHtml(article.sourceName)}</a>`
        : `<span class="source-name">${escapeHtml(article.sourceName)}</span>`;
      if (article.author) {
        detailBody += ` <span class="meta-dot">&middot;</span> ${escapeHtml(article.author)}`;
      }
      detailBody += ` <span class="meta-dot">&middot;</span> <time datetime="${article.publishedAt}">${new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>`;
      if (article.relevanceScore) {
        detailBody += ` <span class="meta-dot">&middot;</span> Relevance: ${article.relevanceScore}/100`;
      }
      if (article.transcript) {
        detailBody += ` <span class="meta-dot">&middot;</span> <a href="#transcript" style="background:var(--accent,#10b981);color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;text-decoration:none;">Transcript available</a>`;
      }
      detailBody += `</div>`;

      if (article.transcriptSummary) {
        // Render structured TLDW + key points from transcript
        const lines = article.transcriptSummary.split('\n').filter(l => l.trim());
        let summaryHtml = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('TLDW:') || trimmed.startsWith('**TLDW')) {
            const text = escapeHtml(trimmed.replace(/^\*?\*?TLDW:?\*?\*?\s*/i, ''));
            summaryHtml += `<p style="margin:0 0 0.75rem 0;"><strong>TLDW:</strong> ${text}</p>`;
          } else if (trimmed.startsWith('Key points:') || trimmed.startsWith('**Key points')) {
            summaryHtml += `<p style="margin:0.75rem 0 0.25rem 0;font-weight:600;">Key points:</p><ul style="margin:0;padding-left:1.25rem;">`;
          } else if (trimmed.startsWith('- ')) {
            summaryHtml += `<li style="margin-bottom:0.35rem;">${escapeHtml(trimmed.slice(2))}</li>`;
          } else {
            summaryHtml += `<p style="margin:0 0 0.5rem 0;">${escapeHtml(trimmed)}</p>`;
          }
        }
        // Close any open <ul>
        if (summaryHtml.includes('<ul') && !summaryHtml.includes('</ul>')) {
          summaryHtml += '</ul>';
        }
        detailBody += `<div class="article-summary" style="line-height:1.6;">${summaryHtml}</div>`;
      } else if (summary) {
        detailBody += `<p class="article-summary">${summary}</p>`;
      }

      if (article.tags.length > 0) {
        detailBody += `<div class="article-tags">${article.tags.map(t => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`).join('')}</div>`;
      }

      if (article.companyMentions.length > 0) {
        detailBody += `<div class="article-tags">${article.companyMentions.map(c => `<a class="company-tag" href="/companies">${escapeHtml(c)}</a>`).join('')}</div>`;
      }

      detailBody += `<a class="original-link" href="${escapeHtml(article.url)}" rel="noopener" target="_blank">Read original article &rarr;</a>`;

      if (article.transcript) {
        detailBody += `<div id="transcript" style="margin-top:1.5rem;border-top:1px solid var(--border,#e5e7eb);padding-top:1.5rem;">`;
        detailBody += `<details>`;
        detailBody += `<summary style="cursor:pointer;font-weight:600;font-size:0.95rem;color:var(--text-secondary,#6b7280);">View Transcript</summary>`;
        // Format transcript: split on >> speaker markers into paragraphs
        const formattedTranscript = escapeHtml(article.transcript)
          .split(/\s*&gt;&gt;\s*/)
          .filter(s => s.trim())
          .map(s => `<p style="margin:0 0 0.75rem 0;">${s.trim()}</p>`)
          .join('');
        detailBody += `<div style="margin-top:0.75rem;padding:1rem;background:var(--card-bg,#f9fafb);border-radius:8px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary,#6b7280);max-height:500px;overflow-y:auto;">${formattedTranscript}</div>`;
        detailBody += `</details>`;
        detailBody += `</div>`;
      }

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
