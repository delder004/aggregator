/**
 * HTML template engine for agenticaiaccounting.com
 *
 * Base layout, shared CSS, and reusable components.
 * Uses template literal functions — no libraries.
 * Mobile-first responsive, dark/light mode via prefers-color-scheme.
 * No client-side JavaScript. Inline CSS. < 50KB per page.
 */

import type { Article, InsightSummary, InsightPeriodType } from '../types';
import { MIN_PUBLISH_SCORE } from '../scoring/classifier';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_TITLE = 'Agentic AI Accounting';
const SITE_DESCRIPTION =
  'The latest on AI agents in accounting, audit, tax, and bookkeeping — updated hourly.';
const SITE_URL = 'https://agenticaiaccounting.com';

// Tags shown in the nav bar filter list
export const NAV_TAGS: { label: string; slug: string }[] = [
  { label: 'All', slug: '' },
  { label: 'Audit', slug: 'audit' },
  { label: 'Tax', slug: 'tax' },
  { label: 'Automation', slug: 'automation' },
  { label: 'Agentic AI', slug: 'agentic-ai' },
  { label: 'Startups', slug: 'startup' },
  { label: 'Big 4', slug: 'big-4' },
  { label: 'Research', slug: 'research' },
  { label: 'Companies', slug: 'companies' },
];

// Source type badge colors
const SOURCE_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  hn:          { bg: '#ff660015', text: '#ff6600', darkBg: '#ff660025', darkText: '#ff8533' },
  youtube:     { bg: '#ff000012', text: '#cc0000', darkBg: '#ff000020', darkText: '#ff4444' },
  arxiv:       { bg: '#b3131315', text: '#b31313', darkBg: '#b3131325', darkText: '#e05555' },
  rss:         { bg: '#ee802015', text: '#c06010', darkBg: '#ee802025', darkText: '#eea050' },
  substack:    { bg: '#ff681515', text: '#ff6815', darkBg: '#ff681525', darkText: '#ff8c42' },
  producthunt: { bg: '#da552f15', text: '#da552f', darkBg: '#da552f25', darkText: '#e8774f' },
  ycombinator: { bg: '#f2652215', text: '#f26522', darkBg: '#f2652225', darkText: '#f5844e' },
};

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function getCSS(): string {
  return `
:root {
  --bg: #fafafa;
  --bg-secondary: #f0f0f2;
  --bg-card: #ffffff;
  --text: #18181b;
  --text-secondary: #52525b;
  --text-tertiary: #a1a1aa;
  --border: #e4e4e7;
  --accent: #0f766e;
  --accent-hover: #0d9488;
  --accent-subtle: #0f766e12;
  --featured-bg: #fefff8;
  --featured-border: #d4d97a;
  --featured-accent: #65a30d;
  --tag-bg: #f0f0f2;
  --tag-text: #52525b;
  --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04);
  --radius: 8px;
  --score-high: #16a34a;
  --score-med: #ca8a04;
  --score-low: #a1a1aa;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #09090b;
    --bg-secondary: #18181b;
    --bg-card: #1c1c20;
    --text: #fafafa;
    --text-secondary: #a1a1aa;
    --text-tertiary: #52525b;
    --border: #27272a;
    --accent: #2dd4bf;
    --accent-hover: #5eead4;
    --accent-subtle: #2dd4bf15;
    --featured-bg: #1a1c12;
    --featured-border: #4d5a1a;
    --featured-accent: #a3e635;
    --tag-bg: #27272a;
    --tag-text: #a1a1aa;
    --shadow: 0 1px 3px rgba(0,0,0,0.4);
    --score-high: #4ade80;
    --score-med: #facc15;
    --score-low: #52525b;
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
  padding:1.25rem 0;
  background:var(--bg-card);
}
.container{
  max-width:780px;
  margin:0 auto;
  padding:0 1.25rem;
}
.header-row{
  display:flex;
  align-items:center;
  gap:0.75rem;
}
.logo{
  display:flex;
  align-items:center;
  justify-content:center;
  width:36px;
  height:36px;
  background:var(--accent);
  border-radius:8px;
  flex-shrink:0;
}
.logo svg{display:block;}
.site-title{
  font-size:1.3rem;
  font-weight:700;
  color:var(--text);
  letter-spacing:-0.03em;
}
.site-title a{color:inherit;}
.site-title a:hover{text-decoration:none;}
.site-tagline{
  font-size:0.82rem;
  color:var(--text-secondary);
  margin-top:0.1rem;
}

/* Nav tags */
.tag-nav{
  display:flex;
  flex-wrap:wrap;
  gap:0.4rem;
  padding:0.7rem 0;
  border-bottom:1px solid var(--border);
  background:var(--bg-card);
}
.tag-nav a{
  font-size:0.78rem;
  padding:0.25rem 0.7rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
  transition:all 0.15s;
  white-space:nowrap;
  font-weight:500;
}
.tag-nav a:hover{background:var(--border);text-decoration:none;}
.tag-nav a.active{background:var(--accent);color:#fff;}

/* Section headers */
.section-label{
  font-size:0.72rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--text-tertiary);
  margin:1.75rem 0 0.5rem;
  padding-bottom:0.4rem;
  border-bottom:1px solid var(--border);
}

/* Time group headers */
.time-group{
  font-size:0.72rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--accent);
  margin:1.5rem 0 0.4rem;
  padding:0.35rem 0;
  display:flex;
  align-items:center;
  gap:0.5rem;
}
.time-group::after{
  content:'';
  flex:1;
  height:1px;
  background:var(--border);
}

/* Article cards */
.article-card{
  display:flex;
  gap:0.85rem;
  padding:0.75rem 0;
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
  font-size:0.93rem;
  font-weight:600;
  line-height:1.35;
  color:var(--text);
}
.article-title a{color:inherit;}
.article-title a:hover{color:var(--accent);}
.article-meta{
  font-size:0.76rem;
  color:var(--text-tertiary);
  margin-top:0.2rem;
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:0.35rem;
}
.source-name{
  color:var(--text-secondary);
  font-weight:500;
}
.source-badge{
  display:inline-flex;
  align-items:center;
  gap:0.25rem;
  font-size:0.68rem;
  font-weight:600;
  padding:0.1rem 0.4rem;
  border-radius:3px;
  letter-spacing:0.02em;
}
.source-badge.hn{background:var(--hn-bg,#ff660015);color:var(--hn-text,#ff6600);}
.source-badge.youtube{background:var(--yt-bg,#ff000012);color:var(--yt-text,#cc0000);}
.source-badge.arxiv{background:var(--arxiv-bg,#b3131315);color:var(--arxiv-text,#b31313);}
.source-badge.rss{background:var(--rss-bg,#ee802015);color:var(--rss-text,#c06010);}
.source-badge.substack{background:var(--substack-bg,#ff681515);color:var(--substack-text,#ff6815);}
.source-badge.producthunt{background:var(--ph-bg,#da552f15);color:var(--ph-text,#da552f);}
.source-badge.ycombinator{background:var(--yc-bg,#f2652215);color:var(--yc-text,#f26522);}
.quality-badge{
  display:inline-block;
  font-size:0.6rem;
  font-weight:700;
  color:var(--accent);
  margin-left:0.15rem;
  vertical-align:middle;
  letter-spacing:0.02em;
}
.social-score{
  display:inline-flex;
  align-items:center;
  gap:0.15rem;
  font-size:0.72rem;
  font-weight:600;
  color:var(--score-high);
}
.company-tag{
  font-size:0.68rem;
  padding:0.1rem 0.4rem;
  border-radius:100px;
  background:var(--accent-subtle);
  color:var(--accent);
  font-weight:500;
}
.company-tag:hover{background:var(--accent);color:#fff;text-decoration:none;}
.meta-dot{color:var(--text-tertiary);}
.article-summary{
  font-size:0.82rem;
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
  gap:0.25rem;
  margin-top:0.35rem;
}
.article-tags a{
  font-size:0.68rem;
  padding:0.1rem 0.4rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
}
.article-tags a:hover{background:var(--border);text-decoration:none;}

/* Score indicator */
.score-dot{
  display:inline-block;
  width:6px;
  height:6px;
  border-radius:50%;
  margin-right:0.15rem;
  vertical-align:middle;
}
.score-high{background:var(--score-high);}
.score-med{background:var(--score-med);}
.score-low{background:var(--score-low);}

/* Featured section */
.featured-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:0.75rem;
  margin-bottom:0.5rem;
}
.featured-card{
  background:var(--featured-bg);
  border:1px solid var(--featured-border);
  border-radius:var(--radius);
  padding:1rem;
}
.featured-card .article-title{font-size:1rem;}
.featured-card .article-summary{
  -webkit-line-clamp:3;
}
.featured-label{
  font-size:0.65rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:var(--featured-accent);
  margin-bottom:0.35rem;
}

/* Trending sidebar */
.trending-bar{
  display:flex;
  flex-wrap:wrap;
  gap:0.4rem;
  padding:0.65rem 0;
  margin-bottom:0.25rem;
}
.trending-tag{
  font-size:0.75rem;
  padding:0.2rem 0.6rem;
  border-radius:100px;
  border:1px solid var(--border);
  color:var(--text-secondary);
  font-weight:500;
  display:inline-flex;
  align-items:center;
  gap:0.3rem;
}
.trending-tag:hover{border-color:var(--accent);color:var(--accent);text-decoration:none;}
.trending-count{
  font-size:0.65rem;
  color:var(--text-tertiary);
  font-weight:400;
}

/* Pagination */
.pagination{
  display:flex;
  justify-content:center;
  gap:0.4rem;
  padding:1.5rem 0;
}
.pagination a,.pagination span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:2rem;
  height:2rem;
  padding:0 0.55rem;
  border-radius:var(--radius);
  font-size:0.82rem;
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
  padding:1.5rem 0;
  margin-top:1rem;
  background:var(--bg-card);
}
.footer-inner{
  text-align:center;
  font-size:0.76rem;
  color:var(--text-tertiary);
}
.site-footer a{color:var(--text-tertiary);}
.site-footer a:hover{color:var(--accent);}
.footer-links{
  display:flex;
  justify-content:center;
  gap:1.2rem;
  flex-wrap:wrap;
  margin-bottom:0.6rem;
}
.footer-stats{
  font-size:0.7rem;
  color:var(--text-tertiary);
  margin-top:0.4rem;
  opacity:0.7;
}

/* About page */
.about-content{padding:1.5rem 0;}
.about-content h1{font-size:1.5rem;margin-bottom:0.75rem;}
.about-content h2{font-size:1.15rem;margin:1.25rem 0 0.5rem;}
.about-content p{margin-bottom:0.75rem;color:var(--text-secondary);}
.about-content ul{margin:0.5rem 0 0.75rem 1.5rem;color:var(--text-secondary);}
.about-content li{margin-bottom:0.3rem;}

/* Source clustering */
.cluster-more{
  margin:-0.25rem 0 0.5rem;
  border:none;
}
.cluster-more summary{
  font-size:0.78rem;
  font-weight:500;
  color:var(--accent);
  cursor:pointer;
  padding:0.35rem 0;
  list-style:none;
}
.cluster-more summary::-webkit-details-marker{display:none;}
.cluster-more summary::before{
  content:'+ ';
  font-weight:600;
}
.cluster-more[open] summary::before{
  content:'− ';
}
.cluster-more .article-card{
  border-left:2px solid var(--border);
  padding-left:0.75rem;
  margin-left:0.25rem;
}

/* Dark mode badge overrides */
@media (prefers-color-scheme: dark) {
  .source-badge.hn{background:#ff660025;color:#ff8533;}
  .source-badge.youtube{background:#ff000020;color:#ff4444;}
  .source-badge.arxiv{background:#b3131325;color:#e05555;}
  .source-badge.rss{background:#ee802025;color:#eea050;}
  .source-badge.substack{background:#ff681525;color:#ff8c42;}
  .source-badge.producthunt{background:#da552f25;color:#e8774f;}
  .source-badge.ycombinator{background:#f2652225;color:#f5844e;}
}

/* Responsive */
@media (max-width:580px){
  .featured-grid{grid-template-columns:1fr;}
  .article-thumb{width:64px;height:48px;}
  .article-title{font-size:0.88rem;}
  .featured-card .article-title{font-size:0.93rem;}
  .tag-nav{gap:0.3rem;}
  .tag-nav a{font-size:0.73rem;padding:0.2rem 0.5rem;}
  .header-row{gap:0.5rem;}
  .logo{width:30px;height:30px;border-radius:6px;}
}

/* Insights */
.insights-grid{display:grid;grid-template-columns:1fr;gap:1rem;margin:1rem 0;}
.insight-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;}
.insight-card h3{font-size:1rem;font-weight:600;margin-bottom:0.3rem;}
.insight-card h3 a{color:var(--text);}
.insight-card h3 a:hover{color:var(--accent);}
.insight-meta{font-size:0.75rem;color:var(--text-tertiary);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.5rem;}
.insight-badge{display:inline-block;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;padding:0.15rem 0.5rem;border-radius:100px;}
.insight-badge.hourly{background:#0f766e15;color:var(--accent);}
.insight-badge.daily{background:#3b82f615;color:#3b82f6;}
.insight-badge.weekly{background:#8b5cf615;color:#8b5cf6;}
.insight-badge.monthly{background:#f59e0b15;color:#f59e0b;}
.insight-badge.quarterly{background:#ef444415;color:#ef4444;}
.insight-preview{font-size:0.85rem;color:var(--text-secondary);-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden;}
.insight-content{padding:1.5rem 0;}
.insight-content h2{font-size:1.15rem;font-weight:600;margin:1.25rem 0 0.5rem;color:var(--text);}
.insight-content h3{font-size:1rem;font-weight:600;margin:1rem 0 0.4rem;color:var(--text);}
.insight-content p{margin-bottom:0.75rem;color:var(--text-secondary);line-height:1.65;}
.insight-content ul,.insight-content ol{margin:0.5rem 0 0.75rem 1.5rem;color:var(--text-secondary);}
.insight-content li{margin-bottom:0.3rem;line-height:1.55;}
.insight-content a{color:var(--accent);}
.insight-header{border-bottom:1px solid var(--border);padding-bottom:1rem;margin-bottom:1rem;}
.insight-header h1{font-size:1.4rem;font-weight:700;margin-bottom:0.3rem;}
.insight-nav{display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0;}
.insight-nav a{font-size:0.82rem;padding:0.3rem 0.8rem;border-radius:100px;border:1px solid var(--border);color:var(--text-secondary);font-weight:500;}
.insight-nav a:hover{border-color:var(--accent);color:var(--accent);text-decoration:none;}
.insight-nav a.active{background:var(--accent);color:#fff;border-color:var(--accent);}

/* Last updated indicator */
.last-updated{
  display:inline-block;
  font-size:0.7rem;
  color:var(--text-tertiary);
  margin-top:0.15rem;
}

/* Search form */
.search-form{
  margin-top:0.6rem;
}
.search-form input{
  width:100%;
  max-width:320px;
  padding:0.4rem 0.75rem;
  border:1px solid var(--border);
  border-radius:100px;
  background:var(--bg-secondary);
  color:var(--text);
  font-size:0.82rem;
  outline:none;
}
.search-form input:focus{
  border-color:var(--accent);
  box-shadow:0 0 0 2px var(--accent-subtle);
}

/* Article detail */
.article-detail{padding:1.5rem 0;}
.article-detail h1{font-size:1.4rem;font-weight:700;line-height:1.3;margin-bottom:0.5rem;}
.article-detail .article-meta{margin-bottom:1rem;}
.article-detail .article-summary{font-size:0.95rem;-webkit-line-clamp:unset;margin-bottom:1rem;line-height:1.6;}
.article-detail .article-tags{margin-bottom:1.5rem;}
.article-detail .original-link{display:inline-block;padding:0.5rem 1.2rem;background:var(--accent);color:#fff;border-radius:var(--radius);font-size:0.85rem;font-weight:500;}
.article-detail .original-link:hover{background:var(--accent-hover);text-decoration:none;}
.related-section{margin-top:2rem;border-top:1px solid var(--border);padding-top:1rem;}

/* Most discussed */
.discussed-list{list-style:none;counter-reset:discussed;padding:0;margin:0.5rem 0;}
.discussed-item{
  counter-increment:discussed;
  padding:0.5rem 0;
  border-bottom:1px solid var(--border);
  display:flex;
  flex-direction:column;
  gap:0.15rem;
}
.discussed-item:last-child{border-bottom:none;}
.discussed-item::before{
  content:counter(discussed);
  font-size:0.7rem;
  font-weight:700;
  color:var(--text-tertiary);
  margin-bottom:0.1rem;
}
.discussed-item a{font-size:0.88rem;font-weight:500;color:var(--text);}
.discussed-item a:hover{color:var(--accent);}
.discussed-meta{font-size:0.73rem;color:var(--text-tertiary);}
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

/** Classify an article into a time group. */
export function timeGroup(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  if (isNaN(then.getTime())) return 'Earlier';

  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Check if same calendar day
  if (
    now.getFullYear() === then.getFullYear() &&
    now.getMonth() === then.getMonth() &&
    now.getDate() === then.getDate()
  ) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    yesterday.getFullYear() === then.getFullYear() &&
    yesterday.getMonth() === then.getMonth() &&
    yesterday.getDate() === then.getDate()
  ) {
    return 'Yesterday';
  }

  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

/** Format an ISO date for the <time> element datetime attribute. */
function formatIsoDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return dateStr;
  }
}

/** Get the score CSS class. */
function scoreClass(score: number | null): string {
  if (!score) return 'score-low';
  if (score >= 70) return 'score-high';
  if (score >= MIN_PUBLISH_SCORE) return 'score-med';
  return 'score-low';
}

/** Map source type to badge label and CSS class. */
function sourceBadge(type: string): { label: string; cls: string } {
  switch (type) {
    case 'hn':          return { label: 'HN', cls: 'hn' };
    case 'youtube':     return { label: 'YouTube', cls: 'youtube' };
    case 'arxiv':       return { label: 'arXiv', cls: 'arxiv' };
    case 'rss':         return { label: 'RSS', cls: 'rss' };
    case 'substack':    return { label: 'Substack', cls: 'substack' };
    case 'producthunt': return { label: 'PH', cls: 'producthunt' };
    case 'ycombinator': return { label: 'YC', cls: 'ycombinator' };
    default:            return { label: type, cls: 'rss' };
  }
}

/** SVG logo — stylized "A" with circuit trace motif. */
function logoSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 2L3 17h3l1.5-3.5h5L14 17h3L10 2zm-1.5 9L10 6.5 11.5 11h-3z" fill="#fff"/>
  <circle cx="15" cy="6" r="1.5" fill="#fff" opacity="0.5"/>
  <line x1="13.5" y1="6" x2="11" y2="8" stroke="#fff" stroke-width="0.75" opacity="0.4"/>
</svg>`;
}

/** Favicon SVG — 32x32 with teal background and white "A" logo. */
function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 20 20">
  <rect width="20" height="20" rx="4" fill="#0f766e"/>
  <path d="M10 2L3 17h3l1.5-3.5h5L14 17h3L10 2zm-1.5 9L10 6.5 11.5 11h-3z" fill="#fff"/>
  <circle cx="15" cy="6" r="1.5" fill="#fff" opacity="0.5"/>
  <line x1="13.5" y1="6" x2="11" y2="8" stroke="#fff" stroke-width="0.75" opacity="0.4"/>
</svg>`;
}

// ---------------------------------------------------------------------------
// Company link map — set once before rendering to link company tags to /company/{id}
// ---------------------------------------------------------------------------

let _companyNameToId: Map<string, string> | undefined;

/** Set the company name → ID map used by article cards for linking. */
export function setCompanyLinkMap(map: Map<string, string>): void {
  _companyNameToId = map;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Render a single article card (standard list form). */
export function articleCard(article: Article): string {
  const title = escapeHtml(article.headline || article.title);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const ago = timeAgo(article.publishedAt);
  const badge = sourceBadge(article.sourceType);
  const sClass = scoreClass(article.relevanceScore);

  const thumb = article.imageUrl
    ? `<img class="article-thumb" src="${escapeHtml(article.imageUrl)}" alt="" loading="lazy" />`
    : '';

  const qualityBadge = article.qualityScore && article.qualityScore >= 70
    ? `<span class="quality-badge">HQ</span>`
    : '';

  const socialDisplay = article.socialScore && article.socialScore > 0
    ? `<span class="meta-dot">&middot;</span> <span class="social-score">&blacktriangle; ${article.socialScore}</span>`
    : '';

  const tags = article.tags.length
    ? `<div class="article-tags">${article.tags
        .map((t) => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`)
        .join('')}</div>`
    : '';

  const companyTags = article.companyMentions && article.companyMentions.length > 0
    ? `<div class="article-tags">${article.companyMentions
        .map((c) => {
          const companyId = _companyNameToId?.get(c);
          const href = companyId ? `/company/${escapeHtml(companyId)}` : '/companies';
          return `<a class="company-tag" href="${href}">${escapeHtml(c)}</a>`;
        })
        .join('')}</div>`
    : '';

  return `<article class="article-card">
  ${thumb}
  <div class="article-body">
    <h3 class="article-title"><a href="${escapeHtml(article.url)}" rel="noopener" target="_blank">${title}</a></h3>
    <div class="article-meta">
      <span class="${sClass} score-dot"></span>${qualityBadge}
      <span class="source-name">${escapeHtml(article.sourceName)}</span>
      <span class="source-badge ${badge.cls}">${badge.label}</span>
      ${ago ? `<span class="meta-dot">&middot;</span> <time datetime="${formatIsoDate(article.publishedAt)}">${ago}</time>` : ''}${socialDisplay}
    </div>
    ${summary ? `<p class="article-summary">${summary}</p>` : ''}
    ${tags}
    ${companyTags}
    <a href="/article/${escapeHtml(article.id)}" class="article-detail-link" style="font-size:0.75rem;color:var(--text-tertiary);">Details</a>
  </div>
</article>`;
}

/** Render a featured article card (larger, with background). */
export function featuredCard(article: Article): string {
  const title = escapeHtml(article.headline || article.title);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const ago = timeAgo(article.publishedAt);
  const badge = sourceBadge(article.sourceType);

  const tags = article.tags.length
    ? `<div class="article-tags">${article.tags
        .map((t) => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`)
        .join('')}</div>`
    : '';

  return `<div class="featured-card">
  <div class="featured-label">Featured</div>
  <h3 class="article-title"><a href="${escapeHtml(article.url)}" rel="noopener" target="_blank">${title}</a></h3>
  <div class="article-meta">
    <span class="source-name">${escapeHtml(article.sourceName)}</span>
    <span class="source-badge ${badge.cls}">${badge.label}</span>
    ${ago ? `<span class="meta-dot">&middot;</span> <time datetime="${formatIsoDate(article.publishedAt)}">${ago}</time>` : ''}
  </div>
  ${summary ? `<p class="article-summary">${summary}</p>` : ''}
  ${tags}
</div>`;
}

/** Render the tag navigation bar. */
export function tagNav(activeTag: string): string {
  const links = NAV_TAGS.map((t) => {
    let href: string;
    if (!t.slug) {
      href = '/';
    } else if (t.slug === 'companies') {
      href = '/companies';
    } else {
      href = `/tag/${t.slug}`;
    }
    const cls = t.slug === activeTag ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${escapeHtml(t.label)}</a>`;
  }).join('\n    ');

  return `<nav class="tag-nav container">
    ${links}
  </nav>`;
}

/** Render trending tags bar with article counts. */
export function trendingTags(tagCounts: { tag: string; count: number }[]): string {
  if (tagCounts.length === 0) return '';

  const sorted = [...tagCounts].sort((a, b) => b.count - a.count).slice(0, 10);

  const items = sorted
    .map(
      (tc) =>
        `<a class="trending-tag" href="/tag/${escapeHtml(tc.tag)}">${escapeHtml(tc.tag.replace(/-/g, ' '))} <span class="trending-count">${tc.count}</span></a>`
    )
    .join('\n    ');

  return `<div class="section-label">Trending This Week</div>
  <div class="trending-bar">
    ${items}
  </div>`;
}

/**
 * Render articles with source clustering.
 *
 * Groups articles by `sourceName`. If a source has 2+ articles whose
 * `publishedAt` dates are all within 2 weeks of each other, the first
 * (newest) article is shown as a full card and the rest are wrapped in
 * a `<details class="cluster-more">` disclosure element.
 */
export function renderSourceClusters(articles: Article[]): string {
  if (articles.length === 0) return '';

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  // Group by sourceName
  const bySource = new Map<string, Article[]>();
  for (const a of articles) {
    const key = a.sourceName;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(a);
  }

  interface Cluster {
    newestDate: number;
    articles: Article[];
  }

  const clusters: Cluster[] = [];

  for (const [, sourceArticles] of bySource) {
    const sorted = [...sourceArticles].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    let subCluster: Article[] = [sorted[0]];
    let subClusterStart = new Date(sorted[0].publishedAt).getTime();

    for (let i = 1; i < sorted.length; i++) {
      const t = new Date(sorted[i].publishedAt).getTime();
      if (subClusterStart - t <= TWO_WEEKS_MS) {
        subCluster.push(sorted[i]);
      } else {
        clusters.push({ newestDate: subClusterStart, articles: subCluster });
        subCluster = [sorted[i]];
        subClusterStart = t;
      }
    }
    clusters.push({ newestDate: subClusterStart, articles: subCluster });
  }

  clusters.sort((a, b) => b.newestDate - a.newestDate);

  let html = '';
  for (const cluster of clusters) {
    if (cluster.articles.length === 1) {
      html += articleCard(cluster.articles[0]);
    } else {
      html += articleCard(cluster.articles[0]);
      const remaining = cluster.articles.slice(1);
      const sourceName = escapeHtml(cluster.articles[0].sourceName);
      html += `<details class="cluster-more">\n`;
      html += `  <summary>${remaining.length} more from ${sourceName}</summary>\n`;
      for (const a of remaining) {
        html += articleCard(a);
      }
      html += `</details>\n`;
    }
  }

  return html;
}

/** Render pagination controls. */
export function pagination(
  currentPage: number,
  totalPages: number,
  basePath: string = ''
): string {
  if (totalPages <= 1) return '';

  const links: string[] = [];

  if (currentPage > 1) {
    const prevHref =
      currentPage === 2 ? basePath || '/' : `${basePath}/page/${currentPage - 1}`;
    links.push(`<a href="${prevHref}">&larr; Prev</a>`);
  }

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

  if (currentPage < totalPages) {
    links.push(
      `<a href="${basePath}/page/${currentPage + 1}">Next &rarr;</a>`
    );
  }

  return `<nav class="pagination">${links.join('\n')}</nav>`;
}

// ---------------------------------------------------------------------------
// Insight components
// ---------------------------------------------------------------------------

/** Convert a periodStart ISO date to a URL-friendly slug. */
export function periodToSlug(periodType: InsightPeriodType, periodStart: string): string {
  const d = new Date(periodStart);
  if (isNaN(d.getTime())) return 'unknown';

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');

  switch (periodType) {
    case 'hourly':
      return `${yyyy}-${mm}-${dd}-${hh}`;
    case 'daily':
      return `${yyyy}-${mm}-${dd}`;
    case 'weekly':
      return `${yyyy}-${mm}-${dd}`;
    case 'monthly':
      return `${yyyy}-${mm}`;
    case 'quarterly': {
      const month = d.getUTCMonth(); // 0-11
      const quarter = Math.floor(month / 3) + 1;
      return `${yyyy}-Q${quarter}`;
    }
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

/** Strip basic markdown formatting from text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')      // headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/__(.+?)__/g, '$1')     // bold alt
    .replace(/_(.+?)_/g, '$1')       // italic alt
    .replace(/`(.+?)`/g, '$1')       // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/^\s*[-*+]\s+/gm, '')   // list items
    .replace(/^\s*\d+\.\s+/gm, '')   // numbered lists
    .replace(/\n{2,}/g, ' ')         // collapse blank lines
    .replace(/\n/g, ' ')             // remaining newlines
    .trim();
}

/** Render a single insight card. */
export function insightCard(summary: InsightSummary): string {
  const title = escapeHtml(summary.title);
  const slug = periodToSlug(summary.periodType, summary.periodStart);
  const href = `/insights/${summary.periodType}/${slug}`;
  const preview = escapeHtml(stripMarkdown(summary.content).slice(0, 200));
  const dateStr = new Date(summary.periodStart).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return `<div class="insight-card">
  <span class="insight-badge ${escapeHtml(summary.periodType)}">${escapeHtml(summary.periodType)}</span>
  <h3><a href="${href}">${title}</a></h3>
  <div class="insight-meta">
    <time datetime="${escapeHtml(summary.periodStart)}">${dateStr}</time>
    <span class="meta-dot">&middot;</span>
    <span>${summary.articleCount} article${summary.articleCount === 1 ? '' : 's'}</span>
  </div>
  <p class="insight-preview">${preview}</p>
</div>`;
}

/** Render the insights navigation pills. */
export function insightNav(activePeriod: string): string {
  const periods: { label: string; href: string; key: string }[] = [
    { label: 'All', href: '/insights', key: '' },
    { label: 'Hourly', href: '/insights/hourly', key: 'hourly' },
    { label: 'Daily', href: '/insights/daily', key: 'daily' },
    { label: 'Weekly', href: '/insights/weekly', key: 'weekly' },
    { label: 'Monthly', href: '/insights/monthly', key: 'monthly' },
    { label: 'Quarterly', href: '/insights/quarterly', key: 'quarterly' },
  ];

  const links = periods
    .map((p) => {
      const cls = p.key === activePeriod ? ' class="active"' : '';
      return `<a href="${p.href}"${cls}>${p.label}</a>`;
    })
    .join('\n    ');

  return `<nav class="insight-nav">
    ${links}
  </nav>`;
}

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  title?: string;
  description?: string;
  path?: string;
  activeTag?: string;
  stats?: { sources: number; articles: number; lastUpdated: string };
  searchQuery?: string;
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
  const stats = options.stats;

  const statsLine = stats
    ? `<div class="footer-stats">Tracking ${stats.sources} sources &middot; ${stats.articles.toLocaleString()} articles scored &middot; Updated ${stats.lastUpdated}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_TITLE)}" href="${SITE_URL}/feed.xml" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(faviconSvg())}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${escapeHtml(SITE_TITLE)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${SITE_URL}/og.svg" />

  <!-- OG Image -->
  <meta property="og:image" content="${SITE_URL}/og.svg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <style>${getCSS()}</style>
</head>
<body>
  <header class="site-header">
    <div class="container">
      <div class="header-row">
        <div class="logo">${logoSvg()}</div>
        <div>
          <div class="site-title"><a href="/">${escapeHtml(SITE_TITLE)}</a></div>
          <p class="site-tagline">${escapeHtml(SITE_DESCRIPTION)}</p>
          ${stats ? `<span class="last-updated">Updated ${escapeHtml(stats.lastUpdated)}</span>` : ''}
        </div>
      </div>
      <form class="search-form" method="GET" action="/search">
        <input type="search" name="q" placeholder="Search articles..." aria-label="Search"${options.searchQuery ? ` value="${escapeHtml(options.searchQuery)}"` : ''} />
      </form>
    </div>
  </header>

  ${tagNav(activeTag)}

  <main class="container">
    ${body}
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-links">
        <a href="/feed.xml">RSS Feed</a>
        <a href="/insights">Insights</a>
        <a href="/about">About</a>
      </div>
      ${statsLine}
    </div>
  </footer>
</body>
</html>`;
}
