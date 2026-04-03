import type { Env } from './types';
import { getArticleById, getRelatedArticles } from './db/queries';
import { layout, articleCard, escapeHtml, readTime } from './renderer/html';

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

    // robots.txt
    if (path === '/robots.txt') {
      return new Response(
        `User-agent: *\nAllow: /\n\nSitemap: https://agenticaiaccounting.com/sitemap.xml\n`,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }
      );
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


    // Newsletter subscribe endpoint (HTML form POST, no JS)
    if (path === '/subscribe' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const email = (formData.get('email') as string || '').trim().toLowerCase();

        // Basic email validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.redirect(`${url.origin}/?subscribed=invalid`, 303);
        }

        await env.DB.prepare(
          'INSERT OR IGNORE INTO subscribers (email, subscribed_at) VALUES (?, ?)'
        ).bind(email, new Date().toISOString()).run();

        return Response.redirect(`${url.origin}/?subscribed=1`, 303);
      } catch {
        return Response.redirect(`${url.origin}/?subscribed=error`, 303);
      }
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
      detailBody += ` <span class="meta-dot">&middot;</span> ${readTime(article)}`;
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

      // Share buttons (no JS — pure URL-based sharing)
      const shareTitle = encodeURIComponent(article.headline || article.title);
      const shareUrl = encodeURIComponent(`https://agenticaiaccounting.com/article/${articleId}`);
      const xIcon = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
      const linkedInIcon = `<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
      const emailIcon = `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
      detailBody += `<div class="share-bar">
        <span>Share:</span>
        <a class="share-btn x" href="https://x.com/intent/tweet?text=${shareTitle}&amp;url=${shareUrl}" target="_blank" rel="noopener">${xIcon} Post</a>
        <a class="share-btn linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">${linkedInIcon} Share</a>
        <a class="share-btn email" href="mailto:?subject=${shareTitle}&amp;body=Check%20out%20this%20article%3A%20${shareUrl}" rel="noopener">${emailIcon} Email</a>
      </div>`;

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

      const articleJsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        'headline': article.headline || article.title,
        'datePublished': article.publishedAt,
        'url': `https://agenticaiaccounting.com/article/${articleId}`,
        'publisher': {
          '@type': 'Organization',
          'name': 'Agentic AI Accounting',
          'url': 'https://agenticaiaccounting.com',
          'logo': { '@type': 'ImageObject', 'url': 'https://agenticaiaccounting.com/og.png' },
        },
        'mainEntityOfPage': { '@type': 'WebPage', '@id': `https://agenticaiaccounting.com/article/${articleId}` },
      };
      if (article.author) {
        articleJsonLd['author'] = { '@type': 'Person', 'name': article.author };
      }
      if (article.aiSummary) {
        articleJsonLd['description'] = article.aiSummary;
      }

      const html = layout(detailBody, {
        title: article.headline || article.title,
        description: article.aiSummary || `Article about ${article.title}`,
        path: `/article/${articleId}`,
        jsonLd: articleJsonLd,
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
      // OG image stored as base64-prefixed PNG
      if (cached.startsWith('__PNG_BASE64__')) {
        const b64 = cached.slice('__PNG_BASE64__'.length);
        const binaryString = atob(b64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Response(bytes, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      const isXml = path.endsWith('.xml');
      let content = cached;

      // Inject newsletter subscription confirmation into HTML pages
      const subscribed = url.searchParams.get('subscribed');
      if (subscribed && !isXml) {
        const msgs: Record<string, string> = {
          '1': 'Thanks for subscribing! You\u2019ll hear from us soon.',
          'invalid': 'Please enter a valid email address.',
          'error': 'Something went wrong. Please try again.',
        };
        const msg = msgs[subscribed];
        if (msg) {
          const isSuccess = subscribed === '1';
          const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;padding:0.75rem 1rem;text-align:center;font-size:0.88rem;font-weight:500;color:#fff;background:${isSuccess ? '#0f766e' : '#dc2626'};">${escapeHtml(msg)}</div>`;
          content = content.replace('<body>', `<body>${banner}`);
        }
      }

      return new Response(content, {
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
