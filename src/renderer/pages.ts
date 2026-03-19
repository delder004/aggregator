/**
 * Page generators for agenticaiaccounting.com
 *
 * Each function produces a Record<string, string> mapping URL paths
 * to fully-rendered HTML strings. The integration layer writes these
 * key-value pairs directly into Cloudflare KV.
 */

import type { Article, Company, CompanyInsight } from '../types';
import {
  layout,
  articleCard,
  featuredCard,
  pagination,
  timeGroup,
  escapeHtml,
  renderSourceClusters,
  setCompanyLinkMap,
  NAV_TAGS,
  type LayoutOptions,
} from './html';
import { diversifyFeatured, diversifyFeed } from './diversity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTICLES_PER_PAGE = 20;
const SITE_URL = 'https://agenticaiaccounting.com';

// ---------------------------------------------------------------------------
// OG Image
// ---------------------------------------------------------------------------

/** Generate a branded 1200x630 SVG for og:image. */
function generateOgImage(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f766e"/>
  <g transform="translate(120,160) scale(6)">
    <path d="M10 2L3 17h3l1.5-3.5h5L14 17h3L10 2zm-1.5 9L10 6.5 11.5 11h-3z" fill="#fff"/>
    <circle cx="15" cy="6" r="1.5" fill="#fff" opacity="0.5"/>
    <line x1="13.5" y1="6" x2="11" y2="8" stroke="#fff" stroke-width="0.75" opacity="0.4"/>
  </g>
  <text x="360" y="290" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="64" font-weight="700" fill="#fff">Agentic AI</text>
  <text x="360" y="370" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="64" font-weight="700" fill="#fff">Accounting</text>
  <text x="360" y="430" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="28" fill="#fff" opacity="0.8">AI + Accounting News — Updated Hourly</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Helpers (general)
// ---------------------------------------------------------------------------

/** Safely extract hostname from a URL string, returning the raw string on failure. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort articles by publishedAt descending (newest first). */
function sortByDate(articles: Article[]): Article[] {
  return [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/** Chunk an array into pages of `size`. */
function paginate<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

/** Collect all unique tags from articles, sorted alphabetically. */
function collectTags(articles: Article[]): string[] {
  const set = new Set<string>();
  for (const a of articles) {
    for (const t of a.tags) {
      set.add(t);
    }
  }
  return [...set].sort();
}

/** Render articles grouped by time period ("Today", "Yesterday", etc.). */
function renderTimeGrouped(articles: Article[]): string {
  if (articles.length === 0) return '';

  // Collect articles into time-group buckets while preserving order
  const groups: { label: string; articles: Article[] }[] = [];
  let currentLabel = '';

  for (const article of articles) {
    const label = timeGroup(article.publishedAt);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, articles: [] });
    }
    groups[groups.length - 1].articles.push(article);
  }

  let html = '';
  for (const g of groups) {
    html += renderSourceClusters(diversifyFeed(g.articles));
  }

  return html;
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

function generateHomepage(
  featured: Article[],
  latest: Article[],
  allArticles: Article[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  const sortedFeatured = sortByDate(featured);
  const sortedLatest = sortByDate(latest);

  // Build homepage (page 1)
  let body = '';

  // Featured section — 2-column grid on desktop
  const topFeatured = sortedFeatured.length > 0
    ? diversifyFeatured(sortedFeatured, 1, 6)
    : [];
  if (topFeatured.length > 0) {
    body += `<div class="section-label">Featured</div>\n`;
    body += `<div class="featured-grid">\n`;
    body += topFeatured.map((a) => featuredCard(a)).join('\n');
    body += `\n</div>\n`;
  }

  // Exclude featured articles from the chronological feed
  const featuredIds = new Set(topFeatured.map((a) => a.id));
  const filteredLatest = sortedLatest.filter((a) => !featuredIds.has(a.id));
  const latestPages = paginate(filteredLatest, ARTICLES_PER_PAGE);
  const totalPages = Math.max(latestPages.length, 1);

  // Most discussed section — articles with highest social engagement this week
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const discussed = [...allArticles]
    .filter(a => a.socialScore && a.socialScore > 0 && a.publishedAt >= sevenDaysAgo)
    .sort((a, b) => (b.socialScore || 0) - (a.socialScore || 0))
    .slice(0, 5);

  if (discussed.length > 0) {
    body += `<div class="section-label">Most Discussed</div>\n`;
    body += `<ol class="discussed-list">\n`;
    for (const a of discussed) {
      const href = `/article/${escapeHtml(a.id)}`;
      const title = escapeHtml(a.headline || a.title);
      const source = escapeHtml(a.sourceName);
      const score = a.socialScore || 0;
      body += `<li class="discussed-item">
  <a href="${href}">${title}</a>
  <span class="discussed-meta">${source} &middot; <span class="social-score">&blacktriangle; ${score}</span></span>
</li>\n`;
    }
    body += `</ol>\n`;
  }

  // Latest section — time-grouped
  body += `<div class="section-label">Latest</div>\n`;
  if (latestPages.length > 0) {
    body += renderTimeGrouped(latestPages[0]);
  } else {
    body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles yet. Check back soon.</p>`;
  }

  body += pagination(1, totalPages);

  pages['/'] = layout(body, {
    path: '/',
    activeTag: '',
    ...layoutOpts,
  });

  // Subsequent pages: /page/2, /page/3 ...
  for (let i = 1; i < latestPages.length; i++) {
    const pageNum = i + 1;
    let pageBody = `<div class="section-label">Latest &mdash; Page ${pageNum}</div>\n`;
    pageBody += renderTimeGrouped(latestPages[i]);
    pageBody += pagination(pageNum, totalPages);

    const path = `/page/${pageNum}`;
    pages[path] = layout(pageBody, {
      title: `Page ${pageNum}`,
      path,
      activeTag: '',
      ...layoutOpts,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Tag pages
// ---------------------------------------------------------------------------

function generateTagPages(
  articles: Article[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  // Always generate pages for nav tags (so /tag/audit etc. never 404),
  // then union with any additional tags found in articles.
  const navTagSlugs = NAV_TAGS
    .map((t) => t.slug)
    .filter((s) => s !== '' && s !== 'companies');
  const articleTags = collectTags(articles);
  const allTagsSet = new Set<string>([...navTagSlugs, ...articleTags]);
  const tags = [...allTagsSet].sort();

  for (const tag of tags) {
    const filtered = sortByDate(
      articles.filter((a) => a.tags.includes(tag))
    );
    const tagPages = paginate(filtered, ARTICLES_PER_PAGE);
    const totalPages = Math.max(tagPages.length, 1);
    const tagLabel = tag.replace(/-/g, ' ');
    const basePath = `/tag/${tag}`;

    // Page 1
    let body = `<div class="section-label">${escapeHtml(tagLabel)}</div>\n`;
    if (tagPages.length > 0) {
      body += renderTimeGrouped(tagPages[0]);
    } else {
      body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles for this tag yet.</p>`;
    }
    body += pagination(1, totalPages, basePath);

    pages[basePath] = layout(body, {
      title: `${tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} — Articles`,
      description: `Articles about ${tagLabel} in AI-powered accounting.`,
      path: basePath,
      activeTag: tag,
      ...layoutOpts,
    });

    // Subsequent tag pages
    for (let i = 1; i < tagPages.length; i++) {
      const pageNum = i + 1;
      const path = `${basePath}/page/${pageNum}`;
      let pageBody = `<div class="section-label">${escapeHtml(tagLabel)} &mdash; Page ${pageNum}</div>\n`;
      pageBody += renderTimeGrouped(tagPages[i]);
      pageBody += pagination(pageNum, totalPages, basePath);

      pages[path] = layout(pageBody, {
        title: `${tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} — Page ${pageNum}`,
        description: `Articles about ${tagLabel} in AI-powered accounting — page ${pageNum}.`,
        path,
        activeTag: tag,
        ...layoutOpts,
      });
    }
  }

  return pages;
}

// ---------------------------------------------------------------------------
// About page
// ---------------------------------------------------------------------------

function generateAboutPage(layoutOpts: Partial<LayoutOptions>): Record<string, string> {
  const body = `
<div class="about-content">
  <h1>About Agentic AI Accounting</h1>
  <p>
    <strong>Agentic AI Accounting</strong> is a fully automated news aggregator
    that tracks the intersection of artificial intelligence and the accounting
    profession. We collect content from across the internet, score it for
    relevance using AI, and publish a clean, fast, ad-free feed — updated
    every hour.
  </p>

  <h2>What We Cover</h2>
  <p>
    Our focus is on <strong>agentic AI</strong> — autonomous AI systems that
    can take actions, make decisions, and complete workflows — as applied to
    accounting, audit, tax, bookkeeping, compliance, and financial reporting.
  </p>
  <ul>
    <li>AI agents automating accounting workflows</li>
    <li>New tools and startups in AI-powered finance</li>
    <li>Research papers on AI in audit and compliance</li>
    <li>Industry analysis from Big 4 firms and trade publications</li>
    <li>Regulatory developments affecting AI in accounting</li>
    <li>Practitioner experiences and case studies</li>
  </ul>

  <h2>How It Works</h2>
  <p>
    Every hour, our system collects new content from RSS feeds,
    Hacker News, YouTube, arXiv, Substack newsletters, and company blogs.
    Each article is scored for both relevance and quality by an AI classifier
    (Claude by Anthropic). Articles scoring above our relevance threshold
    are published to the feed. High-scoring articles receive featured placement.
  </p>
  <p>
    We also track key companies in the AI-accounting space, linking articles
    to the companies they mention. This makes it easy to follow developments
    around specific vendors and startups.
  </p>
  <p>
    There is no editorial staff. The entire pipeline — collection, scoring,
    company tracking, and publishing — is automated. This means the feed is
    comprehensive and timely, though occasional off-topic results may slip through.
  </p>

  <h2>Sources</h2>
  <p>We currently aggregate from:</p>
  <ul>
    <li><strong>RSS feeds:</strong> Accounting Today, Journal of Accountancy,
      Going Concern, CPA Practice Advisor, AccountingWeb, TechCrunch AI,
      VentureBeat AI, and select newsletters and podcasts</li>
    <li><strong>Substack:</strong> AI and accounting-focused newsletters</li>
    <li><strong>Hacker News:</strong> AI + accounting keyword searches</li>
    <li><strong>YouTube:</strong> Key channels and topic searches</li>
    <li><strong>arXiv:</strong> CS/AI papers related to accounting and finance</li>
    <li><strong>Company blogs:</strong> Direct tracking of AI-accounting vendors</li>
    <li><strong>Press releases:</strong> Product launches and industry news</li>
  </ul>

  <h2>Technical Details</h2>
  <p>
    This site is built as a Cloudflare Worker. Pages are pre-rendered static
    HTML — no client-side JavaScript, no tracking, no ads. The entire page
    weighs under 50KB. Data is stored in Cloudflare D1 (SQLite) and cached
    HTML is served from Cloudflare KV for minimal latency.
  </p>

  <h2>Contact</h2>
  <p>
    Questions or suggestions? Reach us at
    <a href="mailto:hello@agenticaiaccounting.com">hello@agenticaiaccounting.com</a>.
  </p>
</div>`;

  return {
    '/about': layout(body, {
      title: 'About',
      description:
        'About Agentic AI Accounting — an automated news aggregator for AI in accounting, audit, tax, and bookkeeping.',
      path: '/about',
      ...layoutOpts,
    }),
  };
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function generateSitemap(
  articles: Article[],
  tags: string[],
  totalLatestPages: number,
  companies?: Company[]
): string {
  const now = new Date().toISOString().split('T')[0];

  let urls = '';

  urls += `  <url><loc>${SITE_URL}/</loc><changefreq>hourly</changefreq><priority>1.0</priority><lastmod>${now}</lastmod></url>\n`;

  for (let i = 2; i <= totalLatestPages; i++) {
    urls += `  <url><loc>${SITE_URL}/page/${i}</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>\n`;
  }

  for (const tag of tags) {
    urls += `  <url><loc>${SITE_URL}/tag/${escapeHtml(tag)}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
  }

  urls += `  <url><loc>${SITE_URL}/companies</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;

  if (companies) {
    for (const c of companies) {
      urls += `  <url><loc>${SITE_URL}/company/${escapeHtml(c.id)}</loc><changefreq>hourly</changefreq><priority>0.6</priority></url>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all static pages for the site.
 *
 * @param articles   All published articles (score >= 50, is_published = true), sorted by date.
 * @param featuredArticles  Articles with score >= 70, for featured placement.
 * @param tags       All known tags (used for tag page generation).
 * @param stats      Optional stats for the footer (sources count, articles count, last updated).
 * @returns A Record mapping URL paths to HTML strings.
 */
export function generateAllPages(
  articles: Article[],
  featuredArticles: Article[],
  tags: string[],
  stats?: { sources: number; crawled: number; articles: number; lastUpdated: string },
  companies?: Company[],
  companyArticles?: Map<string, Article[]>,
  companyInsights?: Map<string, CompanyInsight>
): Record<string, string> {
  const latest = sortByDate(articles);
  const featured = sortByDate(featuredArticles);

  const effectiveTags =
    tags.length > 0 ? tags : collectTags(articles);

  const totalLatestPages = Math.max(
    Math.ceil(latest.length / ARTICLES_PER_PAGE),
    1
  );

  const layoutOpts: Partial<LayoutOptions> = stats ? { stats } : {};

  // Set company name → id lookup for linking company tags in article cards
  if (companies) {
    const nameToId = new Map<string, string>();
    for (const c of companies) {
      nameToId.set(c.name, c.id);
      for (const alias of c.aliases) {
        nameToId.set(alias, c.id);
      }
    }
    setCompanyLinkMap(nameToId);
  }

  const pages: Record<string, string> = {
    ...generateHomepage(featured, latest, articles, layoutOpts),
    ...generateTagPages(articles, layoutOpts),
    ...generateAboutPage(layoutOpts),
  };

  if (companies && companies.length > 0) {
    const articleMap = companyArticles ?? new Map<string, Article[]>();
    const insightMap = companyInsights ?? new Map<string, CompanyInsight>();
    Object.assign(pages, generateCompaniesPage(companies, articleMap, layoutOpts));
    Object.assign(pages, generateCompanyDetailPages(companies, articleMap, insightMap, layoutOpts));
  }

  pages['/og.svg'] = generateOgImage();

  pages['/sitemap.xml'] = generateSitemap(
    articles,
    effectiveTags,
    totalLatestPages,
    companies
  );

  return pages;
}

// ---------------------------------------------------------------------------
// Companies page
// ---------------------------------------------------------------------------

function generateCompaniesPage(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const sorted = [...companies].sort((a, b) => b.articleCount - a.articleCount);

  // Group companies by category
  const categories = new Map<string, Company[]>();
  for (const c of sorted) {
    const cat = c.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(c);
  }

  let companyRows = '';
  for (const [category, cos] of categories) {
    companyRows += `<div class="time-group">${escapeHtml(category)}</div>\n`;
    for (const c of cos) {
      const name = escapeHtml(c.name);
      const desc = c.description ? escapeHtml(c.description) : '';
      const count = c.articleCount;
      const companyArticleCount = companyArticles.get(c.id)?.length ?? 0;
      const articleCount = Math.max(count, companyArticleCount);
      const lastMention = c.lastMentionedAt
        ? `Last mentioned ${new Date(c.lastMentionedAt).toLocaleDateString()}`
        : '';

      companyRows += `<div class="article-card" style="align-items:center;">
  <div class="article-body">
    <h3 class="article-title"><a href="/company/${escapeHtml(c.id)}">${name}</a></h3>
    ${desc ? `<p class="article-summary">${desc}</p>` : ''}
    <div class="article-meta">
      <span class="source-name">${articleCount} article${articleCount !== 1 ? 's' : ''}</span>
      ${c.website ? `<span class="meta-dot">&middot;</span> <a href="${escapeHtml(c.website)}" rel="noopener" target="_blank" style="color:var(--text-tertiary);">${escapeHtml(safeHostname(c.website))}</a>` : ''}
      ${lastMention ? `<span class="meta-dot">&middot;</span> <span>${lastMention}</span>` : ''}
    </div>
  </div>
</div>\n`;
    }
  }

  const body = companies.length === 0
    ? `<div class="section-label">Companies &amp; Startups in Agentic AI Accounting</div>
<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked yet. Check back soon.</p>`
    : `
<div class="section-label">Companies &amp; Startups in Agentic AI Accounting</div>
<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem;">
  Tracking ${companies.length} companies building AI-powered tools for accounting, audit, tax, and bookkeeping.
</p>
${companyRows}`;

  return {
    '/companies': layout(body, {
      title: 'Companies',
      description: 'Companies and startups building agentic AI for accounting, audit, tax, and bookkeeping.',
      path: '/companies',
      ...layoutOpts,
    }),
  };
}

// ---------------------------------------------------------------------------
// Company detail pages
// ---------------------------------------------------------------------------

function generateCompanyDetailPages(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  companyInsights: Map<string, CompanyInsight>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  for (const company of companies) {
    const articles = companyArticles.get(company.id) ?? [];
    const insight = companyInsights.get(company.id);
    const path = `/company/${company.id}`;
    const name = escapeHtml(company.name);

    // Company header
    let body = `<div class="section-label"><a href="/companies" style="color:var(--text-tertiary);">Companies</a> &rsaquo; ${name}</div>\n`;

    body += `<div style="padding:1rem 0;border-bottom:1px solid var(--border);margin-bottom:1rem;">`;
    body += `<h1 style="font-size:1.4rem;font-weight:700;margin-bottom:0.3rem;">${name}</h1>`;
    if (company.description) {
      body += `<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0.5rem;">${escapeHtml(company.description)}</p>`;
    }
    body += `<div class="article-meta">`;
    if (company.category) {
      body += `<span class="company-tag" style="cursor:default;">${escapeHtml(company.category)}</span>`;
    }
    if (company.website) {
      body += `<a href="${escapeHtml(company.website)}" rel="noopener" target="_blank">${escapeHtml(safeHostname(company.website))}</a>`;
    }
    body += `<span>${articles.length} article${articles.length !== 1 ? 's' : ''}</span>`;
    body += `</div>`;
    body += `</div>\n`;

    // Company insight (AI-generated overview)
    if (insight) {
      body += `<div class="insight-card" style="margin:1rem 0;">`;
      body += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">`;
      body += `<span class="insight-badge daily">${escapeHtml(company.name)} Insights</span>`;
      body += `<span style="font-size:0.72rem;color:var(--text-tertiary);">Updated ${new Date(insight.generatedAt).toLocaleDateString()}</span>`;
      body += `</div>`;
      body += `<div class="insight-content" style="padding:0;">\n${insight.contentHtml}\n</div>`;
      body += `</div>\n`;
    }

    // Article feed
    if (articles.length > 0) {
      body += `<div class="section-label">Recent Coverage</div>\n`;
      body += renderTimeGrouped(articles);
    } else {
      body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles yet for ${name}. Check back soon.</p>`;
    }

    pages[path] = layout(body, {
      title: `${company.name} — Feed`,
      description: `Latest news and articles about ${company.name} in AI-powered accounting.`,
      path,
      ...layoutOpts,
    });
  }

  return pages;
}
