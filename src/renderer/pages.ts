/**
 * Page generators for agenticaiaccounting.com
 *
 * Each function produces a Record<string, string> mapping URL paths
 * to fully-rendered HTML strings. The integration layer writes these
 * key-value pairs directly into Cloudflare KV.
 */

import type { Article, InsightSummary, InsightPeriodType, Company } from '../types';
import {
  layout,
  articleCard,
  featuredCard,
  pagination,
  trendingTags,
  timeGroup,
  escapeHtml,
  insightCard,
  insightNav,
  periodToSlug,
  type LayoutOptions,
} from './html';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTICLES_PER_PAGE = 20;
const SITE_URL = 'https://agenticaiaccounting.com';

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

/** Count articles per tag (for trending). */
function countTags(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of articles) {
    for (const t of a.tags) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([tag, count]) => ({ tag, count }));
}

/** Render articles grouped by time period ("Today", "Yesterday", etc.). */
function renderTimeGrouped(articles: Article[]): string {
  if (articles.length === 0) return '';

  let html = '';
  let currentGroup = '';

  for (const article of articles) {
    const group = timeGroup(article.publishedAt);
    if (group !== currentGroup) {
      currentGroup = group;
      html += `<div class="time-group">${escapeHtml(group)}</div>\n`;
    }
    html += articleCard(article);
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

  const latestPages = paginate(sortedLatest, ARTICLES_PER_PAGE);
  const totalPages = Math.max(latestPages.length, 1);

  // Build homepage (page 1)
  let body = '';

  // Featured section — 2-column grid on desktop
  if (sortedFeatured.length > 0) {
    body += `<div class="section-label">Featured</div>\n`;
    const topFeatured = sortedFeatured.slice(0, 6);
    body += `<div class="featured-grid">\n`;
    body += topFeatured.map((a) => featuredCard(a)).join('\n');
    body += `\n</div>\n`;
  }

  // Trending tags
  const tagCounts = countTags(allArticles);
  body += trendingTags(tagCounts);

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
  const tags = collectTags(articles);

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
    Every hour, our system collects new content from RSS feeds, Reddit,
    Hacker News, YouTube, and arXiv. Each article is scored for relevance
    by an AI classifier (Claude by Anthropic). Articles scoring above our
    relevance threshold are published to the feed. High-scoring articles
    receive featured placement.
  </p>
  <p>
    There is no editorial staff. The entire pipeline — collection, scoring,
    and publishing — is automated. This means the feed is comprehensive and
    timely, though occasional off-topic results may slip through.
  </p>

  <h2>Sources</h2>
  <p>We currently aggregate from:</p>
  <ul>
    <li><strong>RSS feeds:</strong> Accounting Today, Journal of Accountancy,
      Going Concern, CPA Practice Advisor, AccountingWeb, TechCrunch AI,
      VentureBeat AI, and select newsletters and podcasts</li>
    <li><strong>Reddit:</strong> r/accounting, r/artificial, r/MachineLearning,
      r/fintech, r/Bookkeeping, r/taxpros</li>
    <li><strong>Hacker News:</strong> AI + accounting keyword searches</li>
    <li><strong>YouTube:</strong> Key channels and topic searches</li>
    <li><strong>arXiv:</strong> CS/AI papers related to accounting and finance</li>
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
// Insights pages
// ---------------------------------------------------------------------------

/** Per-type archive limits. */
const INSIGHT_ARCHIVE_LIMITS: Record<InsightPeriodType, number> = {
  hourly: 48,
  daily: 30,
  weekly: 12,
  monthly: 12,
  quarterly: 8,
};

/** All period types in display order. */
const PERIOD_TYPES: InsightPeriodType[] = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
];

/** Sort summaries by periodStart descending (newest first). */
function sortSummaries(summaries: InsightSummary[]): InsightSummary[] {
  return [...summaries].sort(
    (a, b) =>
      new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
  );
}

function generateInsightsPages(
  summaries: InsightSummary[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};
  const sorted = sortSummaries(summaries);

  // --- Index page: latest summary of each type ---
  {
    const seen = new Set<string>();
    const latestByType: InsightSummary[] = [];
    for (const s of sorted) {
      if (!seen.has(s.periodType)) {
        seen.add(s.periodType);
        latestByType.push(s);
      }
    }

    let body = `<div class="section-label">Insights</div>\n`;
    body += insightNav('');
    body += `<div class="insights-grid">\n`;
    body += latestByType.map((s) => insightCard(s)).join('\n');
    body += `\n</div>\n`;

    pages['/insights'] = layout(body, {
      title: 'Insights',
      description: 'AI-generated summaries and analysis of agentic AI in accounting trends.',
      path: '/insights',
      ...layoutOpts,
    });
  }

  // --- Archive pages per type ---
  for (const periodType of PERIOD_TYPES) {
    const ofType = sorted.filter((s) => s.periodType === periodType);
    const limited = ofType.slice(0, INSIGHT_ARCHIVE_LIMITS[periodType]);

    const typeLabel = periodType.charAt(0).toUpperCase() + periodType.slice(1);
    let body = `<div class="section-label">${escapeHtml(typeLabel)} Insights</div>\n`;
    body += insightNav(periodType);

    if (limited.length > 0) {
      body += `<div class="insights-grid">\n`;
      body += limited.map((s) => insightCard(s)).join('\n');
      body += `\n</div>\n`;
    } else {
      body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No ${periodType} insights yet. Check back soon.</p>`;
    }

    const path = `/insights/${periodType}`;
    pages[path] = layout(body, {
      title: `${typeLabel} Insights`,
      description: `${typeLabel} summaries and analysis of agentic AI in accounting.`,
      path,
      ...layoutOpts,
    });
  }

  // --- Detail pages for each summary ---
  for (const summary of sorted) {
    const slug = periodToSlug(summary.periodType, summary.periodStart);
    const path = `/insights/${summary.periodType}/${slug}`;
    const typeLabel =
      summary.periodType.charAt(0).toUpperCase() + summary.periodType.slice(1);
    const dateStr = new Date(summary.periodStart).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    let body = insightNav(summary.periodType);
    body += `<div class="insight-header">
  <span class="insight-badge ${escapeHtml(summary.periodType)}">${escapeHtml(typeLabel)}</span>
  <h1>${escapeHtml(summary.title)}</h1>
  <div class="insight-meta">
    <time datetime="${escapeHtml(summary.periodStart)}">${dateStr}</time>
    <span class="meta-dot">&middot;</span>
    <span>${summary.articleCount} article${summary.articleCount === 1 ? '' : 's'} analyzed</span>
  </div>
</div>\n`;
    body += `<div class="insight-content">\n${summary.contentHtml}\n</div>\n`;

    pages[path] = layout(body, {
      title: summary.title,
      description: `${typeLabel} insight: ${escapeHtml(summary.title)}`,
      path,
      ...layoutOpts,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function generateSitemap(
  articles: Article[],
  tags: string[],
  totalLatestPages: number
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

  urls += `  <url><loc>${SITE_URL}/insights</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;

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
 * @param articles   All published articles (score >= 40, is_published = true), sorted by date.
 * @param featuredArticles  Articles with score >= 70, for featured placement.
 * @param tags       All known tags (used for tag page generation).
 * @param stats      Optional stats for the footer (sources count, articles count, last updated).
 * @returns A Record mapping URL paths to HTML strings.
 */
export function generateAllPages(
  articles: Article[],
  featuredArticles: Article[],
  tags: string[],
  stats?: { sources: number; articles: number; lastUpdated: string },
  summaries?: InsightSummary[],
  companies?: Company[]
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

  const pages: Record<string, string> = {
    ...generateHomepage(featured, latest, articles, layoutOpts),
    ...generateTagPages(articles, layoutOpts),
    ...generateAboutPage(layoutOpts),
  };

  if (summaries && summaries.length > 0) {
    Object.assign(pages, generateInsightsPages(summaries, layoutOpts));
  }

  if (companies && companies.length > 0) {
    Object.assign(pages, generateCompaniesPage(companies, layoutOpts));
  }

  pages['/sitemap.xml'] = generateSitemap(
    articles,
    effectiveTags,
    totalLatestPages
  );

  return pages;
}

// ---------------------------------------------------------------------------
// Companies page
// ---------------------------------------------------------------------------

function generateCompaniesPage(
  companies: Company[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const sorted = [...companies].sort((a, b) => b.articleCount - a.articleCount);

  const companyRows = sorted
    .map((c) => {
      const name = escapeHtml(c.name);
      const desc = c.description ? escapeHtml(c.description) : '';
      const website = c.website ? escapeHtml(c.website) : '';
      const count = c.articleCount;
      const lastMention = c.lastMentionedAt
        ? `Last mentioned ${new Date(c.lastMentionedAt).toLocaleDateString()}`
        : '';

      return `<div class="article-card" style="align-items:center;">
  <div class="article-body">
    <h3 class="article-title">${website ? `<a href="${website}" rel="noopener" target="_blank">${name}</a>` : name}</h3>
    ${desc ? `<p class="article-summary">${desc}</p>` : ''}
    <div class="article-meta">
      <span class="source-name">${count} article${count !== 1 ? 's' : ''}</span>
      ${lastMention ? `<span class="meta-dot">&middot;</span> <span>${lastMention}</span>` : ''}
    </div>
  </div>
</div>`;
    })
    .join('\n');

  const body = `
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
