/**
 * Page generators for agenticaiaccounting.com
 *
 * Each function produces a Record<string, string> mapping URL paths
 * to fully-rendered HTML strings. The integration layer writes these
 * key-value pairs directly into Cloudflare KV.
 */

import type { Article, Company } from '../types';
import {
  layout,
  articleCard,
  featuredCard,
  pagination,
  trendingTags,
  timeGroup,
  escapeHtml,
  renderSourceClusters,
  type LayoutOptions,
} from './html';
import { diversifyFeatured } from './diversity';

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
    html += `<div class="time-group">${escapeHtml(g.label)}</div>\n`;
    html += renderSourceClusters(g.articles);
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
    const topFeatured = diversifyFeatured(sortedFeatured, 1, 6);
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
    <li><strong>Reddit:</strong> r/accounting, r/artificial, r/MachineLearning,
      r/fintech, r/Bookkeeping, r/taxpros</li>
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
// Companies page
// ---------------------------------------------------------------------------

function generateCompaniesPage(
  companies: Company[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  // Sort companies by article count descending
  const sorted = [...companies].sort((a, b) => b.articleCount - a.articleCount);

  let body = `<div class="section-label">Tracked Companies</div>\n`;
  body += `<p style="color:var(--text-secondary);margin:0.5rem 0 1rem;font-size:0.85rem;">Companies active in AI-powered accounting, ranked by coverage.</p>\n`;

  if (sorted.length === 0) {
    body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked yet.</p>`;
  } else {
    body += `<div style="display:flex;flex-direction:column;gap:0;">\n`;
    for (const company of sorted) {
      const slug = escapeHtml(company.slug);
      const name = escapeHtml(company.name);
      const desc = company.description ? escapeHtml(company.description) : '';
      const lastMention = company.lastMentionedAt
        ? `Last mentioned ${escapeHtml(company.lastMentionedAt.split('T')[0])}`
        : '';

      body += `<a href="/company/${slug}" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;">
  <div>
    <span style="font-weight:600;font-size:0.93rem;color:var(--text);">${name}</span>
    ${desc ? `<span style="font-size:0.8rem;color:var(--text-secondary);margin-left:0.5rem;">${desc}</span>` : ''}
    ${lastMention ? `<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:0.15rem;">${lastMention}</div>` : ''}
  </div>
  <span style="font-size:0.8rem;font-weight:600;color:var(--accent);white-space:nowrap;margin-left:1rem;">${company.articleCount} article${company.articleCount !== 1 ? 's' : ''}</span>
</a>\n`;
    }
    body += `</div>\n`;
  }

  pages['/companies'] = layout(body, {
    title: 'Companies',
    description: 'Companies tracked in AI-powered accounting news.',
    path: '/companies',
    activeTag: 'companies',
    ...layoutOpts,
  });

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
 * @param companies  Optional list of tracked companies for the companies page.
 * @returns A Record mapping URL paths to HTML strings.
 */
export function generateAllPages(
  articles: Article[],
  featuredArticles: Article[],
  tags: string[],
  stats?: { sources: number; articles: number; lastUpdated: string },
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
