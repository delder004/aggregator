/**
 * HTML template engine for agenticaiccounting.com
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
const SITE_URL = 'https://agenticaiccounting.com';

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
  --accent: #a4ff00;
  --accent-hover: #bcff33;
  --accent-subtle: #a4ff0012;
  --featured-bg: #f0ffeb;
  --featured-border: #d4ff66;
  --featured-accent: #a4ff00;
  --tag-bg: #f0f0f2;
  --tag-text: #52525b;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --radius: 12px;
  --radius-lg: 16px;
  --score-high: #16a34a;
  --score-med: #ca8a04;
  --score-low: #a1a1aa;
  --aw-bg: #fff5f5;
  --aw-border: #fecaca;
  --aw-indicator: #b91c1c;
  --aw-tag-bg: #fee2e2;
  --aw-tag-text: #991b1b;
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
    --accent: #a4ff00;
    --accent-hover: #bcff33;
    --accent-subtle: #a4ff0020;
    --featured-bg: #1a2600;
    --featured-border: #5cb800;
    --featured-accent: #a4ff00;
    --tag-bg: #27272a;
    --tag-text: #a1a1aa;
    --shadow: 0 1px 3px rgba(0,0,0,0.4);
    --shadow-lg: 0 4px 12px rgba(0,0,0,0.6);
    --score-high: #4ade80;
    --score-med: #facc15;
    --score-low: #52525b;
    --aw-bg: #1f0a0a;
    --aw-border: #7f1d1d;
    --aw-indicator: #f87171;
    --aw-tag-bg: #450a0a;
    --aw-tag-text: #fca5a5;
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
a{color:var(--accent);text-decoration:none;overflow-wrap:anywhere;}
a:hover{color:var(--accent-hover);text-decoration:underline;}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
:focus:not(:focus-visible){outline:none;}

/* Layout */
.site-header{
  border-bottom:1px solid var(--border);
  padding:1rem 0;
  background:var(--bg-card);
  position:sticky;
  top:0;
  z-index:100;
}
.container{
  max-width:1100px;
  margin:0 auto;
  padding:0 1.5rem;
}
.container-narrow{
  max-width:780px;
  margin:0 auto;
  padding:0 1.5rem;
}
.header-row{
  display:flex;
  align-items:center;
  gap:0.75rem;
}
.site-brand{min-width:0;}
.header-nav{
  display:flex;
  align-items:center;
  gap:0.25rem;
  margin-left:auto;
  flex-wrap:wrap;
  justify-content:flex-end;
}
.header-nav a{
  font-size:0.85rem;
  font-weight:600;
  padding:0.4rem 0.8rem;
  border-radius:8px;
  color:var(--text-secondary);
  white-space:nowrap;
  transition:background 0.15s,color 0.15s;
}
.header-nav a:hover{color:var(--text);background:var(--border);text-decoration:none;}
.header-nav a.active{color:var(--accent);background:var(--tag-bg);}
a.logo{text-decoration:none;}
.logo{
  display:flex;
  align-items:center;
  justify-content:center;
  width:40px;
  height:40px;
  background:var(--accent);
  border-radius:10px;
  flex-shrink:0;
}
.logo svg{display:block;}
.site-title{
  font-size:1.35rem;
  font-weight:700;
  color:var(--text);
  letter-spacing:-0.03em;
}
.site-title a{color:inherit;}
.site-title a:hover{text-decoration:none;}
.site-tagline{
  font-size:0.8rem;
  color:var(--text-secondary);
  margin-top:0.1rem;
}

/* Hero section */
.hero{
  background:#0a1929;
  padding:3rem 0;
  margin-bottom:0;
  color:#fff;
}
.hero h1{
  font-family:ui-serif,Georgia,serif;
  font-size:3.4rem;
  font-weight:800;
  line-height:1.15;
  margin-bottom:0.75rem;
  letter-spacing:-0.04em;
}
@media(max-width:900px){
  .hero h1{font-size:2.8rem;}
}
@media(max-width:640px){
  .hero h1{font-size:1.6rem;}
}
.hero p{
  font-size:1.05rem;
  opacity:0.9;
  max-width:600px;
  line-height:1.6;
}
/* Signal strip */
.signal-strip{
  background:var(--bg-secondary);
  padding:2rem 0;
  border-bottom:1px solid var(--border);
}
.signal-strip .container{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:1.5rem;
}
.signal-item{
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
}
.signal-value{
  font-size:1.75rem;
  font-weight:700;
  color:var(--accent);
  line-height:1;
  margin-bottom:0.25rem;
}
.signal-label{
  font-size:0.75rem;
  font-weight:600;
  color:var(--text-secondary);
  text-transform:uppercase;
  letter-spacing:0.05em;
}

/* Nav tags */
.tag-nav{
  display:flex;
  flex-wrap:wrap;
  gap:0.4rem;
  align-items:center;
}
.tag-nav a{
  font-size:0.78rem;
  padding:0.3rem 0.75rem;
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
  font-size:0.75rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--text-tertiary);
  margin:2rem 0 0.75rem;
  padding-bottom:0.4rem;
  border-bottom:1px solid var(--border);
}
.section-label-row{
  display:flex;
  align-items:center;
  gap:0.75rem;
  margin:2rem 0 0.75rem;
  padding-bottom:0.4rem;
  border-bottom:1px solid var(--border);
}
.section-label-row .section-label{
  margin:0;
  padding:0;
  border:none;
  flex-shrink:0;
}
.section-heading{
  font-family:ui-serif,Georgia,serif;
  font-size:1.8rem;
  font-weight:700;
  color:var(--text);
  margin:2rem 0 1rem;
  letter-spacing:-0.03em;
}
@media(max-width:640px){
  .section-heading{font-size:1.4rem;}
}

/* Latest feed — demoted secondary hierarchy (Phase 1F) */
.latest-feed{
  opacity:0.9;
  margin-top:3rem;
  border-top:1px solid var(--border);
  padding-top:1.5rem;
}
.latest-feed .section-label-row{
  margin-top:0;
  padding-top:0;
}
/* Phase 5B — Latest feed compact secondary treatment */
.latest-feed .article-card{
  padding:0.6rem 0;
}
.latest-feed .article-thumb{
  width:64px;
  height:48px;
}
.latest-feed .article-title{
  font-size:0.88rem;
  font-weight:500;
}
.latest-feed .article-meta{
  font-size:0.7rem;
  margin-top:0.15rem;
}
.latest-feed .article-summary{
  -webkit-line-clamp:1;
  font-size:0.78rem;
  margin-top:0.15rem;
}

/* Article cards */
.article-card{
  display:flex;
  gap:1rem;
  padding:1rem 0;
  border-bottom:1px solid var(--border);
}
.article-card:last-child{border-bottom:none;}
.article-thumb{
  flex-shrink:0;
  width:88px;
  height:66px;
  border-radius:var(--radius);
  background:var(--bg-secondary);
  object-fit:cover;
}
.article-body{flex:1;min-width:0;overflow-wrap:break-word;word-break:break-word;}
.article-title{
  font-size:0.95rem;
  font-weight:600;
  line-height:1.4;
  color:var(--text);
  overflow-wrap:break-word;
  word-break:break-word;
}
.article-title a{color:inherit;}
.article-title a:hover{color:var(--accent);}
.article-meta{
  font-size:0.76rem;
  color:var(--text-tertiary);
  margin-top:0.25rem;
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:0.35rem;
}
.source-name{
  color:var(--text-secondary);
  font-weight:500;
  text-decoration:none;
}
a.source-name:hover{text-decoration:underline;}
.source-badge{
  display:inline-flex;
  align-items:center;
  gap:0.25rem;
  font-size:0.65rem;
  font-weight:600;
  padding:0.1rem 0.35rem;
  border-radius:3px;
  letter-spacing:0.02em;
  background:var(--bg-tertiary);
  color:var(--text-tertiary);
}
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
  font-size:0.7rem;
  padding:0.15rem 0.5rem;
  border-radius:100px;
  background:var(--accent-subtle);
  color:var(--accent);
  font-weight:500;
}
.company-tag:hover{background:var(--accent);color:#fff;text-decoration:none;}
.meta-dot{color:var(--text-tertiary);}
.article-summary{
  font-size:0.84rem;
  color:var(--text-secondary);
  margin-top:0.35rem;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  line-height:1.5;
  overflow-wrap:anywhere;
  word-break:break-word;
}
.article-tags{
  display:flex;
  flex-wrap:wrap;
  gap:0.3rem;
  margin-top:0.4rem;
}
.article-tags a{
  font-size:0.68rem;
  padding:0.15rem 0.5rem;
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
  grid-template-columns:repeat(2,1fr);
  gap:1.5rem;
  margin-bottom:1rem;
}
/* Hero/lead featured card — first child, spans full width with larger treatment */
.featured-card:nth-child(1){
  grid-column:1/-1;
  padding:2rem;
  background:var(--featured-bg);
  border:2px solid var(--featured-border);
}
.featured-card:nth-child(1) .article-title{
  font-size:1.4rem;
  font-weight:700;
  line-height:1.35;
}
.featured-card:nth-child(1) .article-summary{
  -webkit-line-clamp:4;
  line-height:1.6;
  font-size:1rem;
}
/* Supporting featured cards — smaller, uniform treatment */
.featured-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:1.25rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s, transform 0.2s;
}
.featured-card:nth-child(n+2){
  padding:1.25rem;
  border:1px solid var(--border);
  background:var(--bg-card);
}
.featured-card:hover{
  box-shadow:var(--shadow-lg);
  transform:translateY(-2px);
}
.featured-card:nth-child(n+2) .article-title{
  font-size:0.95rem;
  font-weight:500;
  line-height:1.4;
}
.featured-card .article-title{font-size:1rem;line-height:1.4;}
.featured-card .article-summary{
  -webkit-line-clamp:3;
  line-height:1.5;
}
.featured-card:nth-child(n+2) .article-summary{
  -webkit-line-clamp:2;
  font-size:0.9rem;
}
.article-summary-link{color:inherit;text-decoration:none;display:block;}
.article-summary-link:hover .article-summary{color:var(--accent);}
.featured-label{
  font-size:0.65rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:var(--featured-accent);
  margin-bottom:0.5rem;
  display:inline-flex;
  align-items:center;
  gap:0.35rem;
}
.status-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:var(--featured-accent);
  animation:pulse 2s ease-in-out infinite;
}
@keyframes pulse{
  0%,100%{opacity:1;}
  50%{opacity:0.4;}
}

/* Company cards grid */
.company-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:1rem;
  margin:1rem 0;
}
.company-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:1.25rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s, transform 0.2s;
}
.company-card:hover{
  box-shadow:var(--shadow-lg);
  transform:translateY(-2px);
}
.company-card h3{font-size:1rem;font-weight:600;margin-bottom:0.3rem;}
.company-card h3 a{color:var(--text);}
.company-card h3 a:hover{color:var(--accent);text-decoration:none;}
.company-card .card-desc{font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5;}
.company-card .card-meta{font-size:0.73rem;color:var(--text-tertiary);display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;}
.company-card .card-badge{display:inline-block;font-size:0.65rem;font-weight:600;padding:0.15rem 0.5rem;border-radius:100px;background:var(--accent-subtle);color:var(--accent);}

/* Companies table */
.sort-links{
  display:flex;
  gap:0.5rem;
  margin:1rem 0;
  flex-wrap:wrap;
}
.sort-link{
  padding:0.4rem 0.8rem;
  font-size:0.85rem;
  border:1px solid var(--border);
  border-radius:6px;
  background:var(--bg-secondary);
  color:var(--text-secondary);
  text-decoration:none;
  transition:all 0.2s;
}
.sort-link:hover{
  border-color:var(--accent);
  color:var(--accent);
}
.sort-link.active{
  background:var(--accent-subtle);
  border-color:var(--accent);
  color:var(--accent);
  font-weight:600;
}
.table-container{
  overflow-x:auto;
  margin:1rem 0;
  border:1px solid var(--border);
  border-radius:var(--radius);
  background:var(--bg-card);
}
.companies-table{
  width:100%;
  border-collapse:collapse;
  font-size:0.9rem;
}
.companies-table thead{
  background:var(--bg-secondary);
  border-bottom:2px solid var(--border);
}
.companies-table th{
  padding:0.75rem 1rem;
  text-align:left;
  font-weight:600;
  color:var(--text);
  font-size:0.85rem;
  white-space:nowrap;
}
.companies-table tbody tr{
  border-bottom:1px solid var(--border);
  transition:background 0.2s;
}
.companies-table tbody tr:hover{
  background:var(--bg-secondary);
}
.companies-table td{
  padding:0.75rem 1rem;
  color:var(--text-secondary);
}
.table-name{
  font-weight:500;
  color:var(--text);
}
.table-name a{
  color:var(--accent);
  text-decoration:none;
}
.table-name a:hover{
  text-decoration:underline;
}
.table-category{
  font-size:0.8rem;
}
.table-count{
  text-align:center;
  font-weight:500;
  color:var(--text);
}
.table-date{
  font-size:0.8rem;
  white-space:nowrap;
}
.jobs-table{
  width:100%;
  border-collapse:collapse;
  font-size:0.9rem;
}
.jobs-table thead{
  background:var(--bg-secondary);
  border-bottom:2px solid var(--border);
}
.jobs-table th{
  padding:0.75rem 1rem;
  text-align:left;
  font-weight:600;
  color:var(--text);
  font-size:0.85rem;
  white-space:nowrap;
}
.jobs-table tbody tr{
  border-bottom:1px solid var(--border);
  transition:background 0.2s;
}
.jobs-table tbody tr:hover{
  background:var(--bg-secondary);
}
.jobs-table td{
  padding:0.75rem 1rem;
  color:var(--text-secondary);
}
.table-title{
  font-weight:500;
  color:var(--text);
}
.table-title a{
  color:var(--accent);
  text-decoration:none;
}
.table-title a:hover{
  text-decoration:underline;
}
.table-company{
  font-weight:500;
  color:var(--text);
}
.table-company a{
  color:var(--accent);
  text-decoration:none;
}
.table-company a:hover{
  text-decoration:underline;
}
.table-dept{
  font-size:0.8rem;
}
.table-location{
  font-size:0.8rem;
}

/* Market map */
.market-map{
  display:flex;
  flex-direction:column;
  gap:0.5rem;
  margin:1rem 0 0;
}
.market-map-row{
  display:grid;
  grid-template-columns:minmax(160px, 200px) 1fr;
  gap:1rem;
  align-items:start;
  padding:0.75rem 0;
  border-bottom:1px solid var(--border);
}
.market-map-row:last-child{border-bottom:none;}
.market-map-label{
  font-size:0.85rem;
  font-weight:600;
  color:var(--text);
  display:flex;
  flex-direction:column;
  gap:0.15rem;
}
.market-map-label a{color:var(--text);}
.market-map-label a:hover{color:var(--accent);text-decoration:none;}
.market-map-count{
  font-size:0.7rem;
  font-weight:500;
  color:var(--text-tertiary);
}
.market-map-cells{
  display:flex;
  flex-wrap:wrap;
  gap:0.4rem;
  align-items:center;
}
.market-map-empty{
  font-size:0.78rem;
  color:var(--text-tertiary);
  font-style:italic;
}
.market-map-chip{
  display:inline-block;
  padding:0.3rem 0.65rem;
  border-radius:8px;
  background:var(--bg-card);
  border:1px solid var(--border);
  color:var(--text);
  font-size:0.78rem;
  font-weight:500;
  line-height:1.2;
  transition:transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.market-map-chip:hover{
  text-decoration:none;
  border-color:var(--accent);
  color:var(--accent);
  transform:translateY(-1px);
  box-shadow:var(--shadow);
}
.market-map-chip.md{font-size:0.85rem;padding:0.35rem 0.75rem;}
.market-map-chip.lg{
  font-size:0.92rem;
  font-weight:600;
  padding:0.4rem 0.85rem;
  background:var(--accent-subtle);
  border-color:var(--accent-subtle);
  color:var(--accent);
}
.market-map-chip.xl{
  font-size:1rem;
  font-weight:700;
  padding:0.5rem 1rem;
  background:var(--accent);
  border-color:var(--accent);
  color:#fff;
}
.market-map-chip.xl:hover{
  background:var(--accent-hover);
  border-color:var(--accent-hover);
  color:#fff;
}
@media (max-width:640px){
  .market-map-row{grid-template-columns:1fr;gap:0.4rem;}
}

/* Job filters */
.job-filters{
  margin-bottom:1.25rem;
  display:flex;
  flex-wrap:wrap;
  gap:0.5rem;
  align-items:center;
}
.job-filters .job-filter-btn{
  font-size:0.78rem;
  padding:0.4rem 0.85rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
  transition:all 0.15s;
  white-space:nowrap;
  font-weight:500;
  text-decoration:none;
  display:inline-block;
}
.job-filters .job-filter-btn:hover{background:var(--border);text-decoration:none;}
.job-filters .job-filter-btn.active{background:var(--accent);color:#fff;}
.job-dropdown{position:relative;}
.job-dropdown summary{
  font-size:0.78rem;
  padding:0.4rem 0.85rem;
  border-radius:100px;
  background:var(--tag-bg);
  color:var(--tag-text);
  cursor:pointer;
  font-weight:500;
  white-space:nowrap;
  list-style:none;
  display:inline-flex;
  align-items:center;
  gap:0.3rem;
  transition:all 0.15s;
}
.job-dropdown summary::-webkit-details-marker{display:none;}
.job-dropdown summary:hover{background:var(--border);}
.job-dropdown summary.has-active{background:var(--accent);color:#fff;}
.job-dropdown[open] summary{background:var(--border);}
.job-dropdown[open] summary.has-active{background:var(--accent);color:#fff;}
.job-dropdown .dropdown-menu{
  position:absolute;
  top:calc(100% + 0.35rem);
  left:0;
  z-index:50;
  min-width:max(9rem, calc(100vw - 3rem));
  max-width:calc(100vw - 2rem);
  max-height:16rem;
  overflow-y:auto;
  overflow-x:hidden;
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow-lg);
  padding:0.35rem 0;
}
.job-dropdown .dropdown-menu a{
  display:block;
  padding:0.4rem 0.85rem;
  font-size:0.8rem;
  color:var(--text);
  text-decoration:none;
  white-space:nowrap;
}
.job-dropdown .dropdown-menu a:hover{background:var(--tag-bg);}
.job-dropdown .dropdown-menu a.active{color:var(--accent);font-weight:600;}

/* Job cards */
.job-grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:0.75rem;
  margin:0.5rem 0 1rem;
}
.job-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:1rem 1.25rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s;
}
.job-card:hover{box-shadow:var(--shadow-lg);}
.job-card h3{font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;}
.job-card h3 a{color:var(--text);}
.job-card h3 a:hover{color:var(--accent);text-decoration:none;}
.job-card .job-company{font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.35rem;}
.job-card .job-company a{color:var(--accent);font-weight:500;}
.job-card .job-tags{display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;}
.job-card .job-tag{display:inline-block;font-size:0.68rem;padding:0.12rem 0.45rem;border-radius:100px;background:var(--tag-bg);color:var(--tag-text);}
.job-card .job-tag.remote{background:#0d948815;color:#0d9488;}

/* Jobs preview (homepage) */
.jobs-preview-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:1rem;
  margin:1rem 0;
}
.job-preview-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:1rem 1.25rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s;
}
.job-preview-card:hover{box-shadow:var(--shadow-lg);}
.job-preview-card h3{font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;}
.job-preview-card h3 a{color:var(--text);}
.job-preview-card h3 a:hover{color:var(--accent);text-decoration:none;}
.job-preview-card .job-company{font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.35rem;}
.job-preview-card .job-tags{display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;}
.companies-preview-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
  gap:1rem;
  margin:1rem 0;
}
.company-preview-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:1rem 1.25rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s;
}
.company-preview-card:hover{box-shadow:var(--shadow-lg);}
.company-preview-card h3{font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;}
.company-preview-card h3 a{color:var(--text);}
.company-preview-card h3 a:hover{color:var(--accent);text-decoration:none;}
.company-preview-card .company-category{font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.35rem;}
.company-preview-card .company-articles{font-size:0.8rem;color:var(--text-tertiary);}

/* Pagination */
.pagination{
  display:flex;
  justify-content:center;
  gap:0.4rem;
  padding:2rem 0;
}
.pagination a,.pagination span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:2.25rem;
  height:2.25rem;
  padding:0 0.6rem;
  border-radius:var(--radius);
  font-size:0.82rem;
  color:var(--text-secondary);
  border:1px solid var(--border);
  background:var(--bg-card);
}
.pagination a:hover{background:var(--bg-secondary);text-decoration:none;}
.pagination .current{
  background:var(--accent);
  color:#fff;
  border-color:var(--accent);
  font-weight:600;
}

/* Newsletter signup */
.newsletter-box{
  background:linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
  border-radius:var(--radius-lg);
  padding:2rem;
  color:#fff;
  margin:2rem 0;
  text-align:center;
}
.newsletter-box h3{font-size:1.15rem;font-weight:700;margin-bottom:0.4rem;}
.newsletter-box p{font-size:0.88rem;opacity:0.9;margin-bottom:1rem;max-width:500px;margin-left:auto;margin-right:auto;line-height:1.5;}
.newsletter-box .cta-btn{
  display:inline-block;
  background:#fff;
  color:#0f766e;
  font-weight:600;
  font-size:0.88rem;
  padding:0.6rem 1.5rem;
  border-radius:100px;
  text-decoration:none;
  transition:background 0.15s,transform 0.15s;
}
.newsletter-box .cta-btn:hover{background:#f0fdfa;transform:translateY(-1px);text-decoration:none;}

/* Footer */
.site-footer{
  border-top:1px solid var(--border);
  padding:3rem 0 2rem;
  margin-top:2rem;
  background:var(--bg-card);
}
.footer-grid{
  display:grid;
  grid-template-columns:2fr 1fr 1fr 1fr;
  gap:2rem;
  margin-bottom:2rem;
}
.footer-col h4{
  font-size:0.78rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:var(--text);
  margin-bottom:0.75rem;
}
.footer-col a{
  display:block;
  font-size:0.82rem;
  color:var(--text-tertiary);
  padding:0.2rem 0;
}
.footer-col a:hover{color:var(--accent);text-decoration:none;}
.footer-col p{font-size:0.82rem;color:var(--text-tertiary);line-height:1.5;}
.footer-brand{display:flex;align-items:center;gap:0.6rem;margin-bottom:0.75rem;}
.footer-brand .logo{width:32px;height:32px;border-radius:8px;}
.footer-brand span{font-weight:700;font-size:1rem;color:var(--text);}
.footer-bottom{
  border-top:1px solid var(--border);
  padding-top:1.5rem;
  display:flex;
  justify-content:space-between;
  align-items:center;
  flex-wrap:wrap;
  gap:0.75rem;
}
.footer-copyright{
  font-size:0.76rem;
  color:var(--text-tertiary);
}
.footer-links{
  display:flex;
  gap:1.2rem;
  flex-wrap:wrap;
}
.footer-links a{font-size:0.76rem;color:var(--text-tertiary);}
.footer-links a:hover{color:var(--accent);}
.footer-stats{
  font-size:0.72rem;
  color:var(--text-tertiary);
  opacity:0.7;
  width:100%;
  text-align:center;
  margin-top:0.5rem;
}

/* Spotlight / highlights section */
.spotlight-grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:1rem;
  margin:1rem 0;
}
.spotlight-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:1.5rem;
  box-shadow:var(--shadow);
}
.spotlight-card h3{font-size:1rem;font-weight:600;margin-bottom:0.4rem;}
.spotlight-card h3 a{color:var(--text);}
.spotlight-card h3 a:hover{color:var(--accent);text-decoration:none;}
.spotlight-card p{font-size:0.84rem;color:var(--text-secondary);line-height:1.5;}
.spotlight-card .card-meta{font-size:0.73rem;color:var(--text-tertiary);margin-top:0.5rem;}
.spotlight-heading{
  margin-bottom:0.75rem;
  font-size:0.75rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--text-tertiary);
}
.spotlight-item{
  padding:0.4rem 0;
  border-bottom:1px solid var(--border);
}
.spotlight-item:last-child{border-bottom:none;}
.spotlight-item-link{
  font-size:0.88rem;
  font-weight:500;
  color:var(--text);
}
.spotlight-item-link:hover{color:var(--accent);text-decoration:none;}
.spotlight-item-count{
  font-size:0.73rem;
  color:var(--text-tertiary);
  margin-left:0.4rem;
}
.new-roles-list{
  display:flex;
  flex-direction:column;
  gap:0.5rem;
}
.new-role-item{
  padding:0.4rem 0;
  border-bottom:1px solid var(--border);
}
.new-role-item:last-child{border-bottom:none;}
.new-role-title{
  font-size:0.88rem;
  font-weight:500;
  color:var(--text);
  display:block;
  line-height:1.4;
}
.new-role-title:hover{color:var(--accent);text-decoration:none;}
.new-role-company{
  font-size:0.73rem;
  color:var(--text-tertiary);
  margin-top:0.2rem;
}
.view-all{
  margin-top:0.75rem;
  text-align:right;
}
.view-all a{font-size:0.82rem;}

/* Phase 4B: "Work being automated" section */
.automated-work-section{
  background:var(--aw-bg);
  border:1px solid var(--aw-border);
  border-left:3px solid var(--aw-indicator);
  border-radius:var(--radius-lg);
  padding:1.5rem;
  margin:1.5rem 0;
}
.aw-header{
  display:flex;
  align-items:baseline;
  gap:0.75rem;
  margin-bottom:1rem;
  flex-wrap:wrap;
}
.aw-header .section-heading{
  margin-bottom:0;
  border-bottom:none;
  padding-bottom:0;
}
.aw-indicator{
  font-size:0.72rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:var(--aw-indicator);
  white-space:nowrap;
}
.automated-work-list{
  display:flex;
  flex-direction:column;
  gap:0;
}
.automated-work-item{
  padding:0.6rem 0;
  border-bottom:1px solid var(--aw-border);
}
.automated-work-item:last-child{border-bottom:none;}
.aw-tag-badge{
  display:inline-block;
  font-size:0.67rem;
  font-weight:600;
  text-transform:capitalize;
  padding:0.1rem 0.45rem;
  border-radius:100px;
  background:var(--aw-tag-bg);
  color:var(--aw-tag-text);
  margin-bottom:0.2rem;
}
.aw-article-title{
  display:block;
  font-size:0.88rem;
  font-weight:500;
  color:var(--text);
  line-height:1.4;
  overflow-wrap:anywhere;
}
.aw-article-title:hover{color:var(--aw-indicator);text-decoration:none;}
.aw-meta{
  font-size:0.72rem;
  color:var(--text-tertiary);
  margin-top:0.2rem;
}
.empty-state{
  color:var(--text-tertiary);
  padding:2rem 0;
  text-align:center;
}

/* Resources grid */
.resource-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:1rem;
  margin:1rem 0;
}
.resource-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:1.5rem;
  box-shadow:var(--shadow);
  transition:box-shadow 0.2s, transform 0.2s;
}
.resource-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px);}
.resource-card h3{font-size:0.95rem;font-weight:600;margin-bottom:0.35rem;}
.resource-card h3 a{color:var(--text);}
.resource-card h3 a:hover{color:var(--accent);text-decoration:none;}
.resource-card p{font-size:0.82rem;color:var(--text-secondary);line-height:1.5;}
.resource-card .resource-type{display:inline-block;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;padding:0.15rem 0.5rem;border-radius:100px;margin-bottom:0.6rem;}

/* FAQ page */
.faq-list{list-style:none;margin:1.5rem 0;}
.faq-item{border-bottom:1px solid var(--border);padding:1.25rem 0;}
.faq-item:last-child{border-bottom:none;}
.faq-item h3{font-size:1rem;font-weight:600;margin-bottom:0.5rem;color:var(--text);}
.faq-item p{font-size:0.88rem;color:var(--text-secondary);line-height:1.7;margin-bottom:0.4rem;}
.faq-item a{font-weight:500;}

/* About page */
.about-content{padding:2rem 0;}
.about-content h1{font-family:ui-serif,Georgia,serif;font-size:1.8rem;font-weight:800;margin-bottom:1rem;letter-spacing:-0.02em;}
.about-content h2{font-family:ui-serif,Georgia,serif;font-size:1.2rem;font-weight:700;margin:1.5rem 0 0.6rem;}
.about-content p{margin-bottom:0.85rem;color:var(--text-secondary);line-height:1.7;}
.about-content ul{margin:0.5rem 0 0.85rem 1.5rem;color:var(--text-secondary);}
.about-content li{margin-bottom:0.4rem;line-height:1.6;}

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



/* Responsive */
@media (max-width:900px){
  .featured-grid{grid-template-columns:repeat(2,1fr);}
  .featured-card:nth-child(1) .article-title{font-size:1.2rem;}
  .company-grid{grid-template-columns:repeat(2,1fr);}
  .resource-grid{grid-template-columns:repeat(2,1fr);}
  .footer-grid{grid-template-columns:1fr 1fr;}
  .hero h1{font-size:1.8rem;}
}
@media (max-width:768px){
  .featured-card:nth-child(1) .article-title{font-size:1.1rem;}
  .spotlight-grid{grid-template-columns:1fr;}
  .job-grid{grid-template-columns:1fr;}
  .jobs-preview-grid{grid-template-columns:1fr;}
  .companies-preview-grid{grid-template-columns:1fr;}
  .hero{padding:2rem 0;}
  .hero p{font-size:0.95rem;}
  .site-tagline{display:none;}
  .header-nav a{font-size:0.8rem;padding:0.35rem 0.6rem;}
  .companies-table th,.companies-table td{padding:0.6rem 0.75rem;font-size:0.8rem;}
  .table-date{display:none;}
  .companies-table th:nth-child(5),.companies-table td:nth-child(5){display:none;}
  .jobs-table th,.jobs-table td{padding:0.6rem 0.75rem;font-size:0.8rem;}
  .jobs-table th:nth-child(5),.jobs-table td:nth-child(5){display:none;}
}
@media (max-width:580px){
  .featured-grid{grid-template-columns:1fr;}
  .featured-card:nth-child(1){grid-column:1;}
  .featured-card:nth-child(1) .article-title{font-size:1rem;}
  .featured-card:nth-child(1) .article-summary{-webkit-line-clamp:3;}
  .company-grid{grid-template-columns:1fr;}
  .job-grid{grid-template-columns:1fr;}
  .jobs-preview-grid{grid-template-columns:1fr;}
  .companies-preview-grid{grid-template-columns:1fr;}
  .spotlight-grid{grid-template-columns:1fr;}
  .resource-grid{grid-template-columns:1fr;}
  .footer-grid{grid-template-columns:1fr;gap:1.5rem;}
  .article-thumb{width:64px;height:48px;}
  .article-title{font-size:0.88rem;}
  .featured-card .article-title{font-size:0.93rem;}
  .tag-nav{gap:0.3rem;}
  .tag-nav a{font-size:0.73rem;padding:0.45rem 0.75rem;overflow-wrap:anywhere;}
  .job-filter-row a{font-size:0.73rem;padding:0.45rem 0.75rem;}
  .job-filter-label{font-size:0.65rem;}
  .article-tags a{padding:0.35rem 0.65rem;font-size:0.72rem;overflow-wrap:anywhere;}
  .footer-col a{padding:0.45rem 0;}
  .pagination{gap:0.25rem;flex-wrap:wrap;}
  .pagination a,.pagination span{min-width:2.4rem;height:2.4rem;padding:0 0.4rem;}
  .header-row{gap:0.5rem;}
  .logo{width:28px;height:28px;border-radius:6px;}
  .site-brand{display:none;}
  .header-nav{gap:0.1rem;}
  .header-nav a{font-size:0.78rem;padding:0.3rem 0.55rem;}
  .site-header{padding:0.65rem 0;}
  .hero{padding:1.5rem 0;}
  .hero h1{font-size:1.25rem;line-height:1.2;margin-bottom:0.5rem;}
  .hero p{font-size:0.85rem;}
  .signal-strip .container{gap:1rem;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));}
  .signal-value{font-size:1.5rem;}
  .signal-label{font-size:0.7rem;}
  .footer-bottom{flex-direction:column;text-align:center;}
  .job-dropdown .dropdown-menu{min-width:9rem;max-width:calc(100vw - 2rem);}
}
@media (max-width:390px){
  .container{padding:0 1rem;}
  .container-narrow{padding:0 1rem;}
  .pagination{gap:0.15rem;flex-wrap:wrap;justify-content:center;}
  .pagination a,.pagination span{min-width:auto;width:2rem;height:2rem;padding:0 0.25rem;font-size:0.72rem;}
  .job-dropdown .dropdown-menu{min-width:8rem;max-width:calc(100vw - 2rem);}
  .tag-nav a{font-size:0.68rem;padding:0.3rem 0.6rem;}
  .article-meta{font-size:0.72rem;}
  .signal-strip .container{gap:0.75rem;grid-template-columns:repeat(2,1fr);}
  .signal-value{font-size:1.25rem;}
  .signal-label{font-size:0.65rem;}
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
.insight-content h2{font-family:ui-serif,Georgia,serif;font-size:1.15rem;font-weight:600;margin:1.25rem 0 0.5rem;color:var(--text);}
.insight-content h3{font-family:ui-serif,Georgia,serif;font-size:1rem;font-weight:600;margin:1rem 0 0.4rem;color:var(--text);}
.insight-content p{margin-bottom:0.75rem;color:var(--text-secondary);line-height:1.65;}
.insight-content ul,.insight-content ol{margin:0.5rem 0 0.75rem 1.5rem;color:var(--text-secondary);}
.insight-content li{margin-bottom:0.3rem;line-height:1.55;}
.insight-content a{color:var(--accent);}
.insight-header{border-bottom:1px solid var(--border);padding-bottom:1rem;margin-bottom:1rem;}
.insight-header h1{font-family:ui-serif,Georgia,serif;font-size:1.4rem;font-weight:700;margin-bottom:0.3rem;}
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


/* Article detail */
.article-detail{padding:1.5rem 0;}
.article-detail h1{font-family:ui-serif,Georgia,serif;font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:0.75rem;letter-spacing:-0.02em;}
@media(max-width:900px){.article-detail h1{font-size:1.7rem;}}
@media(max-width:640px){.article-detail h1{font-size:1.4rem;letter-spacing:0;}.article-detail .article-summary::first-letter{float:none;font-size:1.1em;line-height:inherit;padding-right:0;}}
.article-detail .article-meta{margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border);}
.article-detail .article-summary{display:flow-root;font-size:0.95rem;-webkit-line-clamp:unset;margin-bottom:1.25rem;line-height:1.7;}
.article-detail .article-summary::first-letter{font-family:ui-serif,Georgia,serif;font-size:3.2em;font-weight:700;float:left;line-height:0.85;padding-right:0.1em;color:var(--text);}
.article-detail .article-tags{margin-bottom:1.5rem;}
.article-detail .original-link{display:inline-block;padding:0.5rem 1.2rem;background:var(--accent);color:#fff;border-radius:var(--radius);font-size:0.85rem;font-weight:500;}
.article-detail .original-link:hover{background:var(--accent-hover);text-decoration:none;}
.share-bar{display:flex;align-items:center;gap:0.5rem;margin-top:1rem;}
.share-bar span{font-size:0.8rem;color:var(--text-secondary);font-weight:500;}
.share-btn{display:inline-flex;align-items:center;gap:0.35rem;padding:0.35rem 0.75rem;border-radius:100px;font-size:0.78rem;font-weight:500;color:#fff;transition:opacity 0.15s;}
.share-btn:hover{opacity:0.85;text-decoration:none;color:#fff;}
.share-btn svg{width:14px;height:14px;fill:currentColor;}
.share-btn.x{background:#000;}
.share-btn.linkedin{background:#0a66c2;}
.share-btn.email{background:var(--text-secondary);}
.related-section{margin-top:2.5rem;border-top:1px solid var(--border);padding-top:1.5rem;}

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

@media (prefers-reduced-motion:reduce){
  .status-dot{animation:none;}
  *,.featured-card,.company-card,.resource-card,.job-card{transition:none !important;}
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

/**
 * Clean up malformed titles that contain concatenated metadata like read time, author names, etc.
 * Examples:
 *   "4-minute read An Introduction to Agentic Financial OperationsJWJon Wolf, CPASenior Solutions..."
 *   "ARTICLE 5 MINUTE READHow to Catch the AI Wave: A Guide for Accounting Firms..."
 * Returns the original string if no obvious malformation is detected.
 */
export function cleanMalformedTitle(title: string): string {
  let cleaned = title;
  
  // Step 1: Remove common metadata prefixes
  const hasPrefix = /^(ARTICLE|MINUTE\s+READ|\d+[-\s]*minute\s+read|\d+[-\s]*min\s+read)/i.test(cleaned);
  if (hasPrefix) {
    cleaned = cleaned
      .replace(/^ARTICLE\s*\d*\s*/i, '')
      .replace(/^\d+[-\s]*minute\s+read\s+/i, '')
      .replace(/^\d+[-\s]*min\s+read\s+/i, '')
      .replace(/^MINUTE\s+READ\s*/i, '')
      .trim();
  }
  
  // Step 2: Handle author initials concatenated to title
  // Pattern 1: Double capital letters immediately followed by capital+lowercase (e.g., "JWJon", "PJPaul")
  // This handles: "TitleJWJon Wolf, CPASenior..." → "Title"
  cleaned = cleaned.replace(/([a-z])([A-Z]{2}[A-Z][a-z]+)(\s|,|$).*$/, '$1');
  
  // Pattern 2: Single capital letter from author's first name (e.g., "Wave Katie" → "Wave")
  // Only if it looks like "WaveCapital Name" where Name is a normal word
  // This handles: "How to Catch the AI WaveKatie Minion, CPA" → "How to Catch the AI Wave"
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z]{2,})(\s+[A-Z][a-z]+)?(\s*,)?.*$/, (match, lastChar, nameStart, rest) => {
    // Only trim if "nameStart" looks like a name (3+ letters starting with capital)
    // and we're not in the middle of a normal title word
    if (nameStart && nameStart.match(/^[A-Z][a-z]{2,}/)) {
      // Check if the character before was lowercase (likely word boundary)
      return lastChar;
    }
    return match;
  });
  
  return cleaned || title;
}

/** Format company employee count range as a human-readable label. */
export function companySizeLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return '';
  if (min != null && max != null) {
    if (min === max) return `${min} employees`;
    return `${min}-${max} employees`;
  }
  if (min != null) return `${min}+ employees`;
  return `Up to ${max} employees`;
}

/** Estimate read time in minutes from text content. Returns "X min read". */
export function readTime(article: Article): string {
  let wordCount = 0;
  if (article.transcript) {
    wordCount += article.transcript.split(/\s+/).length;
  } else if (article.contentSnippet) {
    wordCount += article.contentSnippet.split(/\s+/).length;
  }
  if (article.aiSummary) {
    wordCount += article.aiSummary.split(/\s+/).length;
  }
  // Minimum 1 min, estimate 200 words/min
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} min read`;
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

/** Favicon SVG — 32x32 with blue background and white "A" logo. */
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
  const displayTitle = article.headline || cleanMalformedTitle(article.title);
  const title = escapeHtml(displayTitle);
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

  return `<article class="article-card">
  ${thumb}
  <div class="article-body">
    <h3 class="article-title"><a href="/article/${escapeHtml(article.id)}">${title}</a></h3>
    <div class="article-meta">
      <span class="${sClass} score-dot"></span>${qualityBadge}
      <span class="source-name">${escapeHtml(article.sourceName)}</span>
      <span class="source-badge ${badge.cls}">${badge.label}</span>
      ${ago ? `<span class="meta-dot">&middot;</span> <time datetime="${formatIsoDate(article.publishedAt)}">${ago}</time>` : ''}${socialDisplay}
      <span class="meta-dot">&middot;</span> <span>${readTime(article)}</span>
    </div>
    ${summary ? `<p class="article-summary">${summary}</p>` : ''}
  </div>
</article>`;
}

/** Render a featured article card (larger, with background). */
export function featuredCard(article: Article): string {
  const displayTitle = article.headline || cleanMalformedTitle(article.title);
  const title = escapeHtml(displayTitle);
  const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';
  const ago = timeAgo(article.publishedAt);
  const badge = sourceBadge(article.sourceType);

  const detailHref = `/article/${escapeHtml(article.id)}`;
  let sourceSiteUrl = '';
  try { sourceSiteUrl = new URL(article.url).origin; } catch {}

  return `<div class="featured-card">
  <div class="featured-label"><span class="status-dot"></span> Featured</div>
  <h3 class="article-title"><a href="${detailHref}">${title}</a></h3>
  <div class="article-meta">
    ${sourceSiteUrl ? `<a href="${escapeHtml(sourceSiteUrl)}" class="source-name" target="_blank" rel="noopener">${escapeHtml(article.sourceName)}</a>` : `<span class="source-name">${escapeHtml(article.sourceName)}</span>`}
    <span class="source-badge ${badge.cls}">${badge.label}</span>
    ${ago ? `<span class="meta-dot">&middot;</span> <time datetime="${formatIsoDate(article.publishedAt)}">${ago}</time>` : ''}
    <span class="meta-dot">&middot;</span> <span>${readTime(article)}</span>
  </div>
  ${summary ? `<a href="${detailHref}" class="article-summary-link"><p class="article-summary">${summary}</p></a>` : ''}
</div>`;
}

/** Render the tag navigation bar. */
export function tagNav(activeTag: string, tagsWithArticles?: Set<string>): string {
  const links = NAV_TAGS.filter((t) =>
    t.slug === '' || !tagsWithArticles || tagsWithArticles.has(t.slug)
  ).map((t) => {
    let href: string;
    if (!t.slug) {
      href = '/';
    } else {
      href = `/tag/${t.slug}`;
    }
    const cls = t.slug === activeTag ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${escapeHtml(t.label)}</a>`;
  }).join('\n    ');

  return `<nav class="tag-nav">
    ${links}
  </nav>`;
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

/**
 * Render a signal strip showing key metrics (sources, articles, companies, jobs).
 * Positioned directly under the hero as the first piece of evidence.
 */
export function signalStrip(stats: {
  sources: number;
  articles: number;
  companies: number;
  jobs: number;
}): string {
  return `<div class="signal-strip">
  <div class="container">
    <div class="signal-item">
      <div class="signal-value">${stats.sources.toLocaleString()}</div>
      <div class="signal-label">Sources</div>
    </div>
    <div class="signal-item">
      <div class="signal-value">${stats.articles.toLocaleString()}</div>
      <div class="signal-label">Articles</div>
    </div>
    <div class="signal-item">
      <div class="signal-value">${stats.companies.toLocaleString()}</div>
      <div class="signal-label">Companies</div>
    </div>
    <div class="signal-item">
      <div class="signal-value">${stats.jobs.toLocaleString()}</div>
      <div class="signal-label">Open Roles</div>
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  title?: string;
  description?: string;
  path?: string;
  activeTag?: string;
  activeTab?: 'news' | 'companies' | 'jobs' | 'resources' | '';
  stats?: { sources: number; crawled: number; articles: number; lastUpdated: string };
  heroHtml?: string;
  narrowContainer?: boolean;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
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
  const activeTab = options.activeTab ?? '';
  const stats = options.stats;

  const noindex = options.noindex ?? false;
  const jsonLd = options.jsonLd;
  const heroHtml = options.heroHtml ?? '';
  const containerClass = options.narrowContainer ? 'container-narrow' : 'container';

  const tabs = [
    { label: 'News', href: '/', key: 'news' },
    { label: 'Companies', href: '/companies', key: 'companies' },
    { label: 'Jobs', href: '/jobs', key: 'jobs' },
    { label: 'Resources', href: '/resources', key: 'resources' },
  ];
  const headerNavHtml = `<nav class="header-nav" aria-label="Primary">${tabs.map(t =>
    `<a href="${t.href}"${t.key === activeTab ? ' class="active" aria-current="page"' : ''}>${t.label}</a>`
  ).join('')}</nav>`;

  const statsLine = stats
    ? `<div class="footer-stats">Tracking ${stats.sources} sources &middot; ${stats.crawled.toLocaleString()}+ articles crawled &middot; ${stats.articles.toLocaleString()}+ articles published &middot; Updated ${stats.lastUpdated}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  ${noindex ? '<meta name="robots" content="noindex, follow" />\n  ' : ''}<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_TITLE)}" href="${SITE_URL}/feed.xml" />
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
  <meta name="twitter:image" content="${SITE_URL}/og.png" />

  <!-- OG Image -->
  <meta property="og:image" content="${SITE_URL}/og.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  ${jsonLd ? `<!-- Structured Data -->\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` : ''}
  <style>${getCSS()}</style>
</head>
<body>
  <header class="site-header">
    <div class="container">
      <div class="header-row">
        <a href="/" class="logo" aria-label="Home">${logoSvg()}</a>
        <div class="site-brand">
          <div class="site-title"><a href="/">${escapeHtml(SITE_TITLE)}</a></div>
          <p class="site-tagline">${escapeHtml(SITE_DESCRIPTION)}</p>
        </div>
        ${headerNavHtml}
      </div>
    </div>
  </header>

  ${heroHtml}

  <main class="${containerClass}">
    ${body}
  </main>

  <div class="container">
    <div class="newsletter-box">
      <h3>Stay ahead of AI in accounting</h3>
      <p>Get the latest news on agentic AI for accounting, audit, and tax delivered to your inbox. Curated by AI, reviewed by professionals.</p>
      <a class="cta-btn" href="https://buttondown.com/agenticaiccounting" target="_blank" rel="noopener">Subscribe to Newsletter</a>
    </div>
  </div>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="footer-brand">
            <div class="logo">${logoSvg()}</div>
            <span>${escapeHtml(SITE_TITLE)}</span>
          </div>
          <p>The leading AI-powered news aggregator for accounting professionals. Tracking the intersection of agentic AI and the accounting profession.</p>
        </div>
        <div class="footer-col">
          <h4>Discover</h4>
          <a href="/">Latest News</a>
          <a href="/companies">Companies</a>
          <a href="/jobs">Job Board</a>
          <a href="/resources">Resources</a>
        </div>
        <div class="footer-col">
          <h4>Topics</h4>
          <a href="/tag/audit">Audit</a>
          <a href="/tag/tax">Tax</a>
          <a href="/tag/automation">Automation</a>
          <a href="/tag/agentic-ai">Agentic AI</a>
          <a href="/tag/startup">Startups</a>
          <a href="/tag/big-4">Big 4</a>
          <a href="/tag/research">Research</a>
        </div>
        <div class="footer-col">
          <h4>Connect</h4>
          <a href="/about">About Us</a>
          <a href="/faq">FAQ</a>
          <a href="/feed.xml">RSS Feed</a>
          <a href="mailto:hello@agenticaiccounting.com">Contact</a>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copyright">&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_TITLE)}. All rights reserved.</div>
        <div class="footer-links">
          <a href="/about">About</a>
          <a href="/feed.xml">RSS</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
        ${statsLine}
      </div>
    </div>
  </footer>
</body>
</html>`;
}
