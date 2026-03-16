/**
 * HTML template engine for agenticaiaccounting.com
 *
 * Base layout, shared CSS, and reusable components.
 * Uses template literal functions — no libraries.
 * Mobile-first responsive, dark/light mode via prefers-color-scheme.
 * No client-side JavaScript. Inline CSS. < 50KB per page.
 */

import type { Article } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_TITLE = 'Agentic AI Accounting';
const SITE_DESCRIPTION =
  'The latest news on AI agents in accounting, audit, tax, and bookkeeping — updated hourly.';
const SITE_URL = 'https://agenticaiaccounting.com';

// Tags shown in the nav bar filter list
const NAV_TAGS: { label: string; slug: string }[] = [
  { label: 'All', slug: '' },
  { label: 'Audit', slug: 'audit' },
  { label: 'Tax', slug: 'tax' },
  { label: 'Automation', slug: 'automation' },
  { label: 'Agentic AI', slug: 'agentic-ai' },
  { label: 'Startups', slug: 'startup' },
  { label: 'Big 4', slug: 'big-4' },
  { label: 'Research', slug: 'research' },
];

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function getCSS(): string {
  return `
:root {
  --bg: #ffffff;
  --bg-secondary: #f7f7f8;
  --text: #1a1a1a;
  --text-secondary: #555555;
  --text-tertiary: #888888;
  --border: #e5e5e5;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --featured-bg: #fafbff;
  --featured-border: #dbe4ff;
  --tag-bg: #f0f0f0;
  --tag-text: #444444;
  --shadow: 0 1px 3px rgba(0,0,0,0.06);
  --radius: 6px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111111;
    --bg-secondary: #1a1a1a;
    --text: #e5e5e5;
    --text-secondary: #aaaaaa;
    --text-tertiary: #777777;
    --border: #2a2a2a;
    --accent: #5b8def;
    --accent-hover: #7aa5ff;
    --featured-bg: #151822;
    --featured-border: #252d44;
    --tag-bg: #252525;
    --tag-text: #bbbbbb;
    --shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:16px;-webkit-text-size-adjust:100%;}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif;
  background:var(--bg);
  color:var(--text);
  line-height:1.6;
  min-height:100vh;
}
a{color:var(--accent);text-decoration:none;}
a:hover{color:var(--accent-hover);text-decoration:underline;}

/* Layout */
.site-header{
  border-bottom:1px solid var(--border);
  padding:1rem 0;
}
.container{
  max-width:760px;
  margin:0 auto;
  padding:0 1rem;
}
.site-title{
  font-size:1.35rem;
  font-weight:700;
  color:var(--text);
  letter-spacing:-0.02em;
}
.site-title a{color:inherit;}
.site-title a:hover{text-decoration:none;}
.site-tagline{
  font-size:0.85rem;
  color:var(--text-secondary);
  margin-top:0.15rem;
}

/* Nav tags */
.tag-nav{
  display:flex;
  flex-wrap:wrap;
  gap:0.4rem;
  padding:0.75rem 0;
  border-bottom:1px solid var(--border);
}
.tag-nav a{
  font-size:0.8rem;
  padding:0.25rem 0.65rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
  transition:background 0.15s;
  white-space:nowrap;
}
.tag-nav a:hover{background:var(--border);text-decoration:none;}
.tag-nav a.active{background:var(--accent);color:#fff;}

/* Section headers */
.section-label{
  font-size:0.75rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:var(--text-tertiary);
  margin:1.5rem 0 0.75rem;
}

/* Article cards */
.article-card{
  display:flex;
  gap:0.85rem;
  padding:0.85rem 0;
  border-bottom:1px solid var(--border);
}
.article-card:last-child{border-bottom:none;}
.article-thumb{
  flex-shrink:0;
  width:80px;
  height:60px;
  border-radius:var(--radius);
  background:var(--bg-secondary);
  object-fit:cover;
}
.article-body{flex:1;min-width:0;}
.article-title{
  font-size:0.95rem;
  font-weight:600;
  line-height:1.35;
  color:var(--text);
}
.article-title a{color:inherit;}
.article-title a:hover{color:var(--accent);}
.article-meta{
  font-size:0.78rem;
  color:var(--text-tertiary);
  margin-top:0.2rem;
}
.article-meta .source-badge{
  color:var(--text-secondary);
  font-weight:500;
}
.article-summary{
  font-size:0.83rem;
  color:var(--text-secondary);
  margin-top:0.3rem;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
.article-tags{
  display:flex;
  flex-wrap:wrap;
  gap:0.3rem;
  margin-top:0.35rem;
}
.article-tags a{
  font-size:0.7rem;
  padding:0.1rem 0.45rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
}
.article-tags a:hover{background:var(--border);text-decoration:none;}

/* Featured card */
.featured-card{
  background:var(--featured-bg);
  border:1px solid var(--featured-border);
  border-radius:var(--radius);
  padding:1rem;
  margin-bottom:0.6rem;
}
.featured-card .article-title{font-size:1.05rem;}
.featured-card .article-summary{
  -webkit-line-clamp:3;
}

/* Pagination */
.pagination{
  display:flex;
  justify-content:center;
  gap:0.5rem;
  padding:1.5rem 0;
}
.pagination a,.pagination span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:2rem;
  height:2rem;
  padding:0 0.6rem;
  border-radius:var(--radius);
  font-size:0.85rem;
  color:var(--text-secondary);
  border:1px solid var(--border);
}
.pagination a:hover{background:var(--bg-secondary);text-decoration:none;}
.pagination .current{
  background:var(--accent);
  color:#fff;
  border-color:var(--accent);
  font-weight:600;
}

/* Footer */
.site-footer{
  border-top:1px solid var(--border);
  padding:1.25rem 0;
  margin-top:1rem;
  text-align:center;
  font-size:0.78rem;
  color:var(--text-tertiary);
}
.site-footer a{color:var(--text-tertiary);}
.site-footer a:hover{color:var(--accent);}
.footer-links{
  display:flex;
  justify-content:center;
  gap:1.2rem;
  flex-wrap:wrap;
}

/* About page */
.about-content{padding:1.5rem 0;}
.about-content h1{font-size:1.5rem;margin-bottom:0.75rem;}
.about-content h2{font-size:1.15rem;margin:1.25rem 0 0.5rem;}
.about-content p{margin-bottom:0.75rem;color:var(--text-secondary);}
.about-content ul{margin:0.5rem 0 0.75rem 1.5rem;color:var(--text-secondary);}
.about-content li{margin-bottom:0.3rem;}

/* Responsive */
@media (max-width:480px){
  .article-thumb{width:64px;height:48px;}
  .article-title{font-size:0.9rem;}
  .featured-card .article-title{font-size:0.95rem;}
  .tag-nav{gap:0.3rem;}
  .tag-nav a{font-size:0.75rem;padding:0.2rem 0.5rem;}
}
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape HTML entities for safe rendering in templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Produce a human-readable relative time string from an ISO 8601 date. */
export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return '';

  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

/** Format an ISO date for the <time> element datetime attribute. */
function isoDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return dateStr;
  }
}

/** Format source type into a nicer display label. */
function sourceLabel(article: Article): string {
  const name = escapeHtml(article.sourceName);
  return name;
}

/** Map source type to a small text indicator. */
function sourceTypeIcon(type: string): string {
  switch (type) {
    case 'reddit':
      return 'Reddit';
    case 'hn':
      return 'HN';
    case 'youtube':
      return 'YouTube';
    case 'arxiv':
      return 'arXiv';
    case 'rss':
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Render a single article card (standard list form). */
export function articleCard(article: Article): string {
  const title = escapeHtml(article.title);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const meta = sourceLabel(article);
  const ago = timeAgo(article.publishedAt);
  const typeIcon = sourceTypeIcon(article.sourceType);
  const metaParts = [
    `<span class="source-badge">${meta}</span>`,
    typeIcon ? `<span>${typeIcon}</span>` : '',
    ago ? `<time datetime="${isoDate(article.publishedAt)}">${ago}</time>` : '',
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const thumb = article.imageUrl
    ? `<img class="article-thumb" src="${escapeHtml(article.imageUrl)}" alt="" loading="lazy" />`
    : '';

  const tags = article.tags.length
    ? `<div class="article-tags">${article.tags
        .map((t) => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`)
        .join('')}</div>`
    : '';

  return `<article class="article-card">
  ${thumb}
  <div class="article-body">
    <h3 class="article-title"><a href="${escapeHtml(article.url)}" rel="noopener" target="_blank">${title}</a></h3>
    <div class="article-meta">${metaParts}</div>
    ${summary ? `<p class="article-summary">${summary}</p>` : ''}
    ${tags}
  </div>
</article>`;
}

/** Render a featured article card (larger, with background). */
export function featuredCard(article: Article): string {
  const title = escapeHtml(article.title);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const meta = sourceLabel(article);
  const ago = timeAgo(article.publishedAt);
  const typeIcon = sourceTypeIcon(article.sourceType);
  const metaParts = [
    `<span class="source-badge">${meta}</span>`,
    typeIcon ? `<span>${typeIcon}</span>` : '',
    ago ? `<time datetime="${isoDate(article.publishedAt)}">${ago}</time>` : '',
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const tags = article.tags.length
    ? `<div class="article-tags">${article.tags
        .map((t) => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`)
        .join('')}</div>`
    : '';

  return `<div class="featured-card">
  <h3 class="article-title"><a href="${escapeHtml(article.url)}" rel="noopener" target="_blank">${title}</a></h3>
  <div class="article-meta">${metaParts}</div>
  ${summary ? `<p class="article-summary">${summary}</p>` : ''}
  ${tags}
</div>`;
}

/** Render the tag navigation bar. `activeTag` is the currently selected tag slug (empty string for "All"). */
export function tagNav(activeTag: string): string {
  const links = NAV_TAGS.map((t) => {
    const href = t.slug ? `/tag/${t.slug}` : '/';
    const cls = t.slug === activeTag ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${escapeHtml(t.label)}</a>`;
  }).join('\n    ');

  return `<nav class="tag-nav container">
    ${links}
  </nav>`;
}

/** Render pagination controls. */
export function pagination(
  currentPage: number,
  totalPages: number,
  basePath: string = ''
): string {
  if (totalPages <= 1) return '';

  const links: string[] = [];

  // Previous
  if (currentPage > 1) {
    const prevHref =
      currentPage === 2 ? basePath || '/' : `${basePath}/page/${currentPage - 1}`;
    links.push(`<a href="${prevHref}">&larr; Prev</a>`);
  }

  // Page numbers — show up to 7 pages with ellipsis
  const maxVisible = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  if (start > 1) {
    links.push(`<a href="${basePath || '/'}">1</a>`);
    if (start > 2) links.push(`<span>&hellip;</span>`);
  }

  for (let i = start; i <= end; i++) {
    const href = i === 1 ? basePath || '/' : `${basePath}/page/${i}`;
    if (i === currentPage) {
      links.push(`<span class="current">${i}</span>`);
    } else {
      links.push(`<a href="${href}">${i}</a>`);
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) links.push(`<span>&hellip;</span>`);
    links.push(
      `<a href="${basePath}/page/${totalPages}">${totalPages}</a>`
    );
  }

  // Next
  if (currentPage < totalPages) {
    links.push(
      `<a href="${basePath}/page/${currentPage + 1}">Next &rarr;</a>`
    );
  }

  return `<nav class="pagination">${links.join('\n')}</nav>`;
}

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  title?: string;
  description?: string;
  path?: string;
  activeTag?: string;
}

/**
 * Wrap body content in the full HTML page layout with inline CSS,
 * OG meta tags, header, tag nav, and footer.
 */
export function layout(body: string, options: LayoutOptions = {}): string {
  const pageTitle = options.title
    ? `${escapeHtml(options.title)} — ${SITE_TITLE}`
    : SITE_TITLE;
  const description = options.description
    ? escapeHtml(options.description)
    : escapeHtml(SITE_DESCRIPTION);
  const canonicalPath = options.path ?? '/';
  const canonical = `${SITE_URL}${canonicalPath}`;
  const activeTag = options.activeTag ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_TITLE)}" href="${SITE_URL}/feed.xml" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${escapeHtml(SITE_TITLE)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${description}" />

  <style>${getCSS()}</style>
</head>
<body>
  <header class="site-header">
    <div class="container">
      <div class="site-title"><a href="/">${escapeHtml(SITE_TITLE)}</a></div>
      <p class="site-tagline">${escapeHtml(SITE_DESCRIPTION)}</p>
    </div>
  </header>

  ${tagNav(activeTag)}

  <main class="container">
    ${body}
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-links">
        <a href="/feed.xml">RSS Feed</a>
        <a href="/about">About</a>
        <span>Updated hourly</span>
      </div>
    </div>
  </footer>
</body>
</html>`;
}
