/**
 * Page generators for agenticaiaccounting.com
 *
 * Each function produces a Record<string, string> mapping URL paths
 * to fully-rendered HTML strings. The integration layer writes these
 * key-value pairs directly into Cloudflare KV.
 */

import type { Article, Company, CompanyInsight, CompanyJob, InsightSummary } from '../types';
import {
  layout,
  articleCard,
  featuredCard,
  pagination,
  tagNav,
  timeGroup,
  escapeHtml,
  renderSourceClusters,
  setCompanyLinkMap,
  NAV_TAGS,
  insightCard,
  companySizeLabel,
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

/**
 * Base64-encoded 1200x630 PNG with teal gradient for og:image.
 * Social platforms (Twitter, Facebook, LinkedIn) don't render SVG og:images,
 * so we serve a raster PNG instead. Replace this with a professionally
 * designed PNG for better branding.
 */
const OG_IMAGE_PNG_BASE64 = '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';

/** Decode the base64 OG image PNG to raw bytes for serving. */
function decodeOgImagePng(): Uint8Array {
  const binaryString = atob(OG_IMAGE_PNG_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Return base64-encoded OG PNG for KV storage. Prefixed to distinguish from HTML. */
function generateOgImagePng(): string {
  return `__PNG_BASE64__${OG_IMAGE_PNG_BASE64}`;
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
  layoutOpts: Partial<LayoutOptions>,
  companies?: Company[],
  companyJobs?: Map<string, CompanyJob[]>,
  insights?: InsightSummary[]
): Record<string, string> {
  const pages: Record<string, string> = {};

  const tagsWithArticles = new Set<string>();
  for (const a of allArticles) {
    for (const t of a.tags) tagsWithArticles.add(t);
  }

  const sortedFeatured = sortByDate(featured);
  const sortedLatest = sortByDate(latest);

  // Hero section
  const stats = layoutOpts.stats;
  const totalJobs = companyJobs
    ? [...companyJobs.values()].reduce((sum, jobs) => sum + jobs.length, 0)
    : 0;
  const heroHtml = `<div class="hero">
  <div class="container">
    <h1>AI + Accounting News</h1>
    <p>Your daily source for the latest in agentic AI for accounting, audit, tax, and bookkeeping. Automatically curated and AI-scored from ${stats ? stats.sources : '50'}+ sources.</p>
    <div class="hero-stats">
      <div class="hero-stat"><span class="hero-stat-value">${stats ? stats.articles.toLocaleString() : '0'}</span><span class="hero-stat-label">Articles Published</span></div>
      <div class="hero-stat"><span class="hero-stat-value">${companies ? companies.length : '0'}</span><span class="hero-stat-label">Companies Tracked</span></div>
      <div class="hero-stat"><span class="hero-stat-value">${totalJobs}</span><span class="hero-stat-label">Open Roles</span></div>
    </div>
  </div>
</div>`;

  // Build homepage (page 1)
  let body = '';

  // Featured section — 3-column grid on desktop
  const topFeatured = sortedFeatured.length > 0
    ? diversifyFeatured(sortedFeatured, 1, 6)
    : [];
  if (topFeatured.length > 0) {
    body += `<h2 class="section-heading">Featured Stories</h2>\n`;
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
    body += `<div class="spotlight-grid" style="margin-top:1.5rem;">\n`;
    body += `<div class="spotlight-card">`;
    body += `<h3 style="margin-bottom:0.75rem;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);">Trending This Week</h3>`;
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
    body += `</div>\n`;

    // Latest insights preview (if available)
    if (insights && insights.length > 0) {
      const latestInsight = insights[0];
      body += `<div class="spotlight-card">`;
      body += `<h3 style="margin-bottom:0.75rem;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);">Latest Insight</h3>`;
      body += insightCard(latestInsight);
      if (insights.length > 1) {
        body += `<div style="margin-top:0.75rem;text-align:right;"><a href="/insights" style="font-size:0.82rem;">View all insights &rarr;</a></div>`;
      }
      body += `</div>\n`;
    } else {
      // Company spotlight instead
      if (companies && companies.length > 0) {
        const topCompanies = [...companies]
          .sort((a, b) => b.articleCount - a.articleCount)
          .slice(0, 4);
        body += `<div class="spotlight-card">`;
        body += `<h3 style="margin-bottom:0.75rem;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);">Top Companies</h3>`;
        for (const c of topCompanies) {
          body += `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border);">
  <a href="/company/${escapeHtml(c.id)}" style="font-size:0.88rem;font-weight:500;color:var(--text);">${escapeHtml(c.name)}</a>
  <span style="font-size:0.73rem;color:var(--text-tertiary);margin-left:0.4rem;">${c.articleCount} articles</span>
</div>\n`;
        }
        body += `<div style="margin-top:0.75rem;text-align:right;"><a href="/companies" style="font-size:0.82rem;">View all companies &rarr;</a></div>`;
        body += `</div>\n`;
      }
    }
    body += `</div>\n`;
  }

  // Latest section — time-grouped with inline tag filter
  body += `<div class="section-label-row"><div class="section-label">Latest</div>${tagNav('', tagsWithArticles)}</div>\n`;
  if (latestPages.length > 0) {
    body += renderTimeGrouped(latestPages[0]);
  } else {
    body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles yet. Check back soon.</p>`;
  }

  body += pagination(1, totalPages);

  pages['/'] = layout(body, {
    path: '/',
    activeTag: '',
    activeTab: 'news',
    heroHtml,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': 'Agentic AI Accounting',
      'url': SITE_URL,
      'description': 'The latest on AI agents in accounting, audit, tax, and bookkeeping — updated hourly.',
      'publisher': {
        '@type': 'Organization',
        'name': 'Agentic AI Accounting',
        'url': SITE_URL,
        'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/og.png` },
      },
    },
    ...layoutOpts,
  });

  // Subsequent pages: /page/2, /page/3 ...
  for (let i = 1; i < latestPages.length; i++) {
    const pageNum = i + 1;
    let pageBody = `<div class="section-label-row"><div class="section-label">Latest &mdash; Page ${pageNum}</div>${tagNav('', tagsWithArticles)}</div>\n`;
    pageBody += renderTimeGrouped(latestPages[i]);
    pageBody += pagination(pageNum, totalPages);

    const path = `/page/${pageNum}`;
    pages[path] = layout(pageBody, {
      title: `Page ${pageNum}`,
      path,
      activeTag: '',
      activeTab: 'news',
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

  const tagsWithArticles = new Set<string>();
  for (const a of articles) {
    for (const t of a.tags) tagsWithArticles.add(t);
  }

  // Always generate pages for nav tags (so /tag/audit etc. never 404),
  // then union with any additional tags found in articles.
  const navTagSlugs = NAV_TAGS
    .map((t) => t.slug)
    .filter((s) => s !== '');
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
    let body = `<div class="section-label-row"><div class="section-label">Latest</div>${tagNav(tag, tagsWithArticles)}</div>\n`;
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
      activeTab: 'news',
      noindex: filtered.length < 5,
      ...layoutOpts,
    });

    // Subsequent tag pages
    for (let i = 1; i < tagPages.length; i++) {
      const pageNum = i + 1;
      const path = `${basePath}/page/${pageNum}`;
      let pageBody = `<div class="section-label-row"><div class="section-label">Latest &mdash; Page ${pageNum}</div>${tagNav(tag, tagsWithArticles)}</div>\n`;
      pageBody += renderTimeGrouped(tagPages[i]);
      pageBody += pagination(pageNum, totalPages, basePath);

      pages[path] = layout(pageBody, {
        title: `${tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} — Page ${pageNum}`,
        description: `Articles about ${tagLabel} in AI-powered accounting — page ${pageNum}.`,
        path,
        activeTag: tag,
        activeTab: 'news',
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
// FAQ page
// ---------------------------------------------------------------------------

function generateFaqPage(layoutOpts: Partial<LayoutOptions>): Record<string, string> {
  const faqs: { q: string; a: string }[] = [
    {
      q: 'What is Agentic AI Accounting?',
      a: 'Agentic AI Accounting is a fully automated news aggregator that tracks the intersection of artificial intelligence and the accounting profession. We collect content from 50+ sources, score it for relevance using AI, and publish a clean, fast, ad-free feed — updated every hour.',
    },
    {
      q: 'How are articles scored and selected?',
      a: 'Every article is evaluated by an AI classifier (Claude by Anthropic) that assigns a relevance score from 0 to 100. Articles scoring 50 or above are published to the feed. Articles scoring 70+ receive featured placement on the homepage. The AI also generates a headline, summary, and topic tags for each article.',
    },
    {
      q: 'How often is the site updated?',
      a: 'The collection pipeline runs every hour. New articles are fetched from all sources, scored, and published automatically. The "Updated" timestamp in the header shows the last successful pipeline run.',
    },
    {
      q: 'What sources do you aggregate from?',
      a: 'We currently pull from RSS feeds (Accounting Today, Journal of Accountancy, Going Concern, CPA Practice Advisor, and more), Substack newsletters, Hacker News, YouTube, arXiv research papers, company blogs, and press releases. See the <a href="/about">About page</a> for the full list.',
    },
    {
      q: 'Why don\'t I see a specific article from a source you track?',
      a: 'There are a few reasons an article might not appear: it may have scored below our relevance threshold of 50, it may not have been picked up in the collection window, or the source feed may not have included it. Our AI scoring prioritizes articles specifically about AI applied to accounting, audit, tax, and bookkeeping — general AI or general accounting news may not qualify.',
    },
    {
      q: 'Can I submit a source or company to be tracked?',
      a: 'Yes! We\'re always looking to expand our coverage. Send the source URL or company name to <a href="mailto:hello@agenticaiaccounting.com">hello@agenticaiaccounting.com</a> and we\'ll evaluate it for inclusion.',
    },
    {
      q: 'How does the company tracker work?',
      a: 'We maintain a list of companies building AI-powered tools for accounting. When an article mentions a tracked company, it\'s automatically linked to that company\'s profile page. Company pages show recent coverage, AI-generated insights, and open job listings pulled from their careers pages.',
    },
    {
      q: 'Where do job listings come from?',
      a: 'Job listings are collected directly from company career pages via Greenhouse, Lever, and Ashby job board APIs. They\'re refreshed regularly and removed when no longer active. We don\'t post jobs manually — they\'re all sourced automatically from tracked companies.',
    },
    {
      q: 'Is there an RSS feed?',
      a: 'Yes. You can subscribe at <a href="/feed.xml">/feed.xml</a> to get the latest articles in any RSS reader. The feed includes the 50 most recent articles with AI-generated summaries.',
    },
    {
      q: 'Is there any client-side JavaScript or tracking?',
      a: 'No. This site is pure static HTML with inline CSS — no client-side JavaScript, no cookies, no analytics trackers, no ads. Every page is pre-rendered and served from Cloudflare\'s edge network for minimal latency. Total page weight is under 50KB.',
    },
    {
      q: 'Who runs this site?',
      a: 'Agentic AI Accounting is an independent project. The entire pipeline — collection, scoring, company tracking, and publishing — is automated. There is no editorial staff. Questions or feedback? Reach us at <a href="mailto:hello@agenticaiaccounting.com">hello@agenticaiaccounting.com</a>.',
    },
  ];

  let body = `<h2 class="section-heading">Frequently Asked Questions</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:0.5rem;line-height:1.6;">Everything you need to know about Agentic AI Accounting.</p>\n`;
  body += `<ul class="faq-list">\n`;

  for (const faq of faqs) {
    body += `<li class="faq-item">
  <h3>${escapeHtml(faq.q)}</h3>
  <p>${faq.a}</p>
</li>\n`;
  }

  body += `</ul>\n`;

  return {
    '/faq': layout(body, {
      title: 'FAQ',
      description: 'Frequently asked questions about Agentic AI Accounting — how it works, sources, scoring, and more.',
      path: '/faq',
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
  urls += `  <url><loc>${SITE_URL}/jobs</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/insights</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/resources</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/faq</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;

  // Article detail pages
  for (const a of articles) {
    const lastmod = new Date(a.publishedAt).toISOString().split('T')[0];
    urls += `  <url><loc>${SITE_URL}/article/${escapeHtml(a.id)}</loc><changefreq>weekly</changefreq><priority>0.6</priority><lastmod>${lastmod}</lastmod></url>\n`;
  }

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
  companyInsights?: Map<string, CompanyInsight>,
  companyJobs?: Map<string, CompanyJob[]>,
  insights?: InsightSummary[]
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

  const jobsMap = companyJobs ?? new Map<string, CompanyJob[]>();

  const pages: Record<string, string> = {
    ...generateHomepage(featured, latest, articles, layoutOpts, companies, jobsMap, insights),
    ...generateTagPages(articles, layoutOpts),
    ...generateAboutPage(layoutOpts),
    ...generateFaqPage(layoutOpts),
    ...generateInsightsPage(insights ?? [], layoutOpts),
    ...generateResourcesPage(layoutOpts),
  };

  if (companies && companies.length > 0) {
    const articleMap = companyArticles ?? new Map<string, Article[]>();
    const insightMap = companyInsights ?? new Map<string, CompanyInsight>();
    Object.assign(pages, generateCompaniesPage(companies, articleMap, jobsMap, layoutOpts));
    Object.assign(pages, generateCompanyDetailPages(companies, articleMap, insightMap, jobsMap, layoutOpts));
  }
  Object.assign(pages, generateJobsPage(companies ?? [], jobsMap, layoutOpts));

  pages['/og.png'] = generateOgImagePng();

  pages['/sitemap.xml'] = generateSitemap(
    articles,
    effectiveTags,
    totalLatestPages,
    companies
  );

  return pages;
}

// ---------------------------------------------------------------------------
// Insights page
// ---------------------------------------------------------------------------

function generateInsightsPage(
  insights: InsightSummary[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  let body = '';

  body += `<h2 class="section-heading">AI Accounting Insights</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.5rem;line-height:1.6;">AI-generated summaries and analysis of the latest trends in agentic AI for accounting. Updated regularly with key themes, emerging patterns, and industry developments.</p>\n`;

  if (insights.length === 0) {
    body += `<div class="spotlight-grid">\n`;
    body += `<div class="spotlight-card">
  <h3 style="margin-bottom:0.5rem;">Coming Soon</h3>
  <p>We're building AI-generated insights that analyze trends across all our sources. Check back soon for periodic summaries covering key themes in AI-powered accounting.</p>
</div>\n`;
    body += `<div class="spotlight-card">
  <h3 style="margin-bottom:0.5rem;">What to Expect</h3>
  <p>Daily, weekly, and monthly digests that synthesize the most important developments. Each insight covers emerging tools, regulatory changes, company movements, and research breakthroughs.</p>
</div>\n`;
    body += `</div>\n`;
  } else {
    body += `<div class="insights-grid">\n`;
    for (const insight of insights) {
      body += insightCard(insight);
    }
    body += `</div>\n`;
  }

  return {
    '/insights': layout(body, {
      title: 'Insights',
      description: 'AI-generated insights and analysis of trends in agentic AI for accounting.',
      path: '/insights',
      activeTab: 'insights',
      ...layoutOpts,
    }),
  };
}

// ---------------------------------------------------------------------------
// Resources page
// ---------------------------------------------------------------------------

function generateResourcesPage(
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  let body = '';

  body += `<h2 class="section-heading">Resources</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.5rem;line-height:1.6;">Essential resources for understanding the intersection of artificial intelligence and the accounting profession.</p>\n`;

  body += `<div class="resource-grid">\n`;

  // Resource cards
  const resources = [
    {
      type: 'Guide',
      typeColor: 'background:#0f766e15;color:#0f766e;',
      title: 'What is Agentic AI?',
      desc: 'An introduction to autonomous AI agents and how they\'re being applied in accounting workflows — from data entry to complex audit procedures.',
    },
    {
      type: 'Industry',
      typeColor: 'background:#16a34a15;color:#16a34a;',
      title: 'Big 4 &amp; AI Adoption',
      desc: 'How Deloitte, PwC, EY, and KPMG are integrating AI agents into their audit, tax, and advisory practices. Key partnerships and investments.',
    },
    {
      type: 'Technology',
      typeColor: 'background:#f59e0b15;color:#f59e0b;',
      title: 'AI Tools for Accountants',
      desc: 'A curated directory of AI-powered tools for bookkeeping, tax preparation, audit automation, compliance monitoring, and financial reporting.',
    },
    {
      type: 'Research',
      typeColor: 'background:#8b5cf615;color:#8b5cf6;',
      title: 'Academic Research',
      desc: 'Key academic papers exploring AI applications in accounting — from machine learning for fraud detection to NLP for financial document analysis.',
    },
    {
      type: 'Regulatory',
      typeColor: 'background:#ef444415;color:#ef4444;',
      title: 'AI Regulation &amp; Compliance',
      desc: 'How evolving AI regulations affect the accounting profession. Standards from AICPA, PCAOB, FASB, and international bodies on AI use in financial reporting.',
    },
    {
      type: 'Career',
      typeColor: 'background:#0d948815;color:#0d9488;',
      title: 'AI Skills for CPAs',
      desc: 'The skills accounting professionals need in the AI era. From prompt engineering to understanding AI audit tools, and how to future-proof your career.',
    },
  ];

  for (const r of resources) {
    body += `<div class="resource-card">
  <span class="resource-type" style="${r.typeColor}">${r.type}</span>
  <h3>${r.title}</h3>
  <p>${r.desc}</p>
</div>\n`;
  }

  body += `</div>\n`;

  // Additional sections
  body += `<h2 class="section-heading" style="margin-top:2.5rem;">Stay Informed</h2>\n`;
  body += `<div class="spotlight-grid">\n`;
  body += `<div class="spotlight-card">
  <h3><a href="/feed.xml">RSS Feed</a></h3>
  <p>Subscribe to our RSS feed to get the latest AI + accounting news delivered to your favorite reader. Updated hourly with AI-scored, curated content.</p>
  <div class="card-meta"><a href="/feed.xml" style="font-weight:500;">Subscribe &rarr;</a></div>
</div>\n`;
  body += `<div class="spotlight-card">
  <h3><a href="/companies">Company Tracker</a></h3>
  <p>Follow the companies building the future of AI-powered accounting. Track funding rounds, product launches, and industry partnerships in real time.</p>
  <div class="card-meta"><a href="/companies" style="font-weight:500;">Browse companies &rarr;</a></div>
</div>\n`;
  body += `</div>\n`;

  return {
    '/resources': layout(body, {
      title: 'Resources',
      description: 'Essential resources for understanding AI in accounting — guides, tools, research, and career development.',
      path: '/resources',
      activeTab: 'resources',
      ...layoutOpts,
    }),
  };
}

// ---------------------------------------------------------------------------
// Companies page
// ---------------------------------------------------------------------------

function generateCompaniesPage(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  companyJobs: Map<string, CompanyJob[]>,
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
    companyRows += `<h2 class="section-heading">${escapeHtml(category)}</h2>\n`;
    companyRows += `<div class="company-grid">\n`;
    for (const c of cos) {
      const name = escapeHtml(c.name);
      const desc = c.description ? escapeHtml(c.description) : '';
      const articleCount = companyArticles.get(c.id)?.length ?? 0;
      const jobCount = companyJobs?.get(c.id)?.length ?? 0;

      const sizeLabel = companySizeLabel(c.employeeCountMin ?? null, c.employeeCountMax ?? null);

      companyRows += `<div class="company-card">
  <h3><a href="/company/${escapeHtml(c.id)}">${name}</a></h3>
  ${desc ? `<p class="card-desc">${desc}</p>` : ''}
  <div class="card-meta">
    ${c.category ? `<span class="card-badge">${escapeHtml(c.category)}</span>` : ''}
    <span>${articleCount} article${articleCount !== 1 ? 's' : ''}</span>
    ${jobCount > 0 ? `<span class="meta-dot">&middot;</span> <span style="color:var(--accent);">${jobCount} open role${jobCount !== 1 ? 's' : ''}</span>` : ''}
    ${sizeLabel ? `<span class="meta-dot">&middot;</span> <span>${escapeHtml(sizeLabel)}</span>` : ''}
    ${c.website ? `<span class="meta-dot">&middot;</span> <a href="${escapeHtml(c.website)}" rel="noopener" target="_blank">${escapeHtml(safeHostname(c.website))}</a>` : ''}
  </div>
</div>\n`;
    }
    companyRows += `</div>\n`;
  }

  const body = companies.length === 0
    ? `<h2 class="section-heading">Companies &amp; Startups</h2>
<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked yet. Check back soon.</p>`
    : `
<h2 class="section-heading">Companies &amp; Startups in AI Accounting</h2>
<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:0.5rem;line-height:1.6;">
  Tracking ${companies.length} companies building AI-powered tools for accounting, audit, tax, and bookkeeping.
</p>
${companyRows}`;

  return {
    '/companies': layout(body, {
      title: 'Companies',
      description: 'Companies and startups building agentic AI for accounting, audit, tax, and bookkeeping.',
      path: '/companies',
      activeTab: 'companies',
      ...layoutOpts,
    }),
  };
}

// ---------------------------------------------------------------------------
// Company detail pages
// ---------------------------------------------------------------------------

function renderJobsSection(jobs: CompanyJob[], companyName: string): string {
  if (jobs.length === 0) return '';

  // Group by department
  const departments = new Map<string, CompanyJob[]>();
  for (const job of jobs) {
    const dept = job.department || 'Other';
    const existing = departments.get(dept) ?? [];
    existing.push(job);
    departments.set(dept, existing);
  }

  // Sort departments alphabetically, but put "Other" last
  const sortedDepts = [...departments.keys()].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  let html = `<div class="section-label">Open Roles (${jobs.length})</div>\n`;

  for (const dept of sortedDepts) {
    const deptJobs = departments.get(dept)!;
    html += `<div style="font-size:0.78rem;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin:1rem 0 0.5rem;">${escapeHtml(dept)}</div>\n`;
    html += `<div class="job-grid">\n`;
    for (const job of deptJobs) {
      const remoteBadge = job.isRemote ? `<span class="job-tag remote">Remote</span>` : '';
      const locationBadge = job.location ? `<span class="job-tag">${escapeHtml(job.location)}</span>` : '';
      html += `<div class="job-card">
  <h3><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></h3>
  <div class="job-tags">${remoteBadge}${locationBadge}</div>
</div>\n`;
    }
    html += `</div>\n`;
  }

  return html;
}

function generateCompanyDetailPages(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  companyInsights: Map<string, CompanyInsight>,
  companyJobs: Map<string, CompanyJob[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  for (const company of companies) {
    const articles = companyArticles.get(company.id) ?? [];
    const insight = companyInsights.get(company.id);
    const jobs = companyJobs.get(company.id) ?? [];
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
    if (jobs.length > 0) {
      body += `<span class="meta-dot">&middot;</span> <a href="#jobs" style="color:var(--accent);">${jobs.length} open role${jobs.length !== 1 ? 's' : ''}</a>`;
    }
    const detailSizeLabel = companySizeLabel(company.employeeCountMin ?? null, company.employeeCountMax ?? null);
    if (detailSizeLabel) {
      body += `<span class="meta-dot">&middot;</span> <span>${escapeHtml(detailSizeLabel)}</span>`;
    }
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

    // Open roles section
    if (jobs.length > 0) {
      body += `<div id="jobs">\n`;
      body += renderJobsSection(jobs, company.name);
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
      activeTab: 'companies',
      ...layoutOpts,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Jobs page
// ---------------------------------------------------------------------------

type EnrichedJob = CompanyJob & { companyName: string; companyId: string };

/** Slugify a string for URL use. */
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Render a filter nav bar for job pages. */
function jobFilterNav(
  departments: string[],
  locations: string[],
  activeFilter: string,
  hasRemote: boolean
): string {
  let html = `<nav class="tag-nav" style="margin-bottom:1rem;">\n`;
  html += `  <a href="/jobs"${activeFilter === '' ? ' class="active"' : ''}>All</a>\n`;
  if (hasRemote) {
    html += `  <a href="/jobs/remote"${activeFilter === 'remote' ? ' class="active"' : ''}>Remote</a>\n`;
  }
  for (const dept of departments.slice(0, 10)) {
    const slug = slugify(dept);
    html += `  <a href="/jobs/dept/${slug}"${activeFilter === `dept-${slug}` ? ' class="active"' : ''}>${escapeHtml(dept)}</a>\n`;
  }
  for (const loc of locations.slice(0, 8)) {
    const slug = slugify(loc);
    html += `  <a href="/jobs/location/${slug}"${activeFilter === `loc-${slug}` ? ' class="active"' : ''}>${escapeHtml(loc)}</a>\n`;
  }
  html += `</nav>\n`;
  return html;
}

/** Render job cards grouped by company. */
function renderJobCards(jobs: EnrichedJob[]): string {
  if (jobs.length === 0) {
    return `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No matching jobs found.</p>`;
  }

  let body = '';
  const byCompany = new Map<string, EnrichedJob[]>();
  for (const job of jobs) {
    const existing = byCompany.get(job.companyId) ?? [];
    existing.push(job);
    byCompany.set(job.companyId, existing);
  }

  const sortedCompanyIds = [...byCompany.keys()].sort((a, b) =>
    (byCompany.get(b)?.length ?? 0) - (byCompany.get(a)?.length ?? 0)
  );

  for (const companyId of sortedCompanyIds) {
    const companyJobs = byCompany.get(companyId)!;
    const companyName = companyJobs[0].companyName;
    body += `<div class="section-label"><a href="/company/${escapeHtml(companyId)}" style="color:inherit;text-decoration:none;">${escapeHtml(companyName)}</a> &mdash; ${companyJobs.length} role${companyJobs.length !== 1 ? 's' : ''}</div>\n`;
    body += `<div class="job-grid">\n`;

    for (const job of companyJobs) {
      const remoteBadge = job.isRemote ? `<span class="job-tag remote">Remote</span>` : '';
      const locationBadge = job.location ? `<span class="job-tag">${escapeHtml(job.location)}</span>` : '';
      const deptBadge = job.department ? `<span class="job-tag">${escapeHtml(job.department)}</span>` : '';

      body += `<div class="job-card">
  <h3><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></h3>
  <div class="job-company"><a href="/company/${escapeHtml(companyId)}">${escapeHtml(companyName)}</a></div>
  <div class="job-tags">${remoteBadge}${locationBadge}${deptBadge}</div>
</div>\n`;
    }
    body += `</div>\n`;
  }

  return body;
}

function generateJobsPage(
  companies: Company[],
  companyJobs: Map<string, CompanyJob[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  // Collect all jobs, attaching company info
  const allJobs: EnrichedJob[] = [];
  for (const company of companies) {
    const jobs = companyJobs.get(company.id) ?? [];
    for (const job of jobs) {
      allJobs.push({ ...job, companyName: company.name, companyId: company.id });
    }
  }

  // Sort by postedAt descending (newest first), then by company name
  allJobs.sort((a, b) => {
    const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const db = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    if (db !== da) return db - da;
    return a.companyName.localeCompare(b.companyName);
  });

  // Collect unique departments and locations for filter nav
  const deptCounts = new Map<string, number>();
  const locCounts = new Map<string, number>();
  let remoteCount = 0;
  for (const job of allJobs) {
    if (job.department) {
      deptCounts.set(job.department, (deptCounts.get(job.department) ?? 0) + 1);
    }
    if (job.location) {
      locCounts.set(job.location, (locCounts.get(job.location) ?? 0) + 1);
    }
    if (job.isRemote) remoteCount++;
  }
  // Sort by count descending
  const departments = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const locations = [...locCounts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const hasRemote = remoteCount > 0;

  const filterNav = jobFilterNav(departments, locations, '', hasRemote);
  const companiesWithJobs = companies.filter(c => (companyJobs.get(c.id) ?? []).length > 0);

  // Main /jobs page (all jobs)
  let body = '';
  if (allJobs.length === 0) {
    body += `<h2 class="section-heading">Open Roles in AI Accounting</h2>\n`;
    body += filterNav;
    body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No job listings yet. Check back soon.</p>`;
  } else {
    body += `<h2 class="section-heading">Open Roles in AI Accounting</h2>\n`;
    body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${allJobs.length} open role${allJobs.length !== 1 ? 's' : ''} across ${companiesWithJobs.length} companies building the future of AI-powered accounting.</p>\n`;
    body += filterNav;
    body += renderJobCards(allJobs);
  }

  pages['/jobs'] = layout(body, {
    title: 'Jobs',
    description: 'Open roles at companies building agentic AI for accounting, audit, tax, and bookkeeping.',
    path: '/jobs',
    activeTab: 'jobs',
    ...layoutOpts,
  });

  // Remote filter page
  if (hasRemote) {
    const remoteJobs = allJobs.filter(j => j.isRemote);
    let remoteBody = `<h2 class="section-heading">Remote Roles in AI Accounting</h2>\n`;
    remoteBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${remoteJobs.length} remote role${remoteJobs.length !== 1 ? 's' : ''} available.</p>\n`;
    remoteBody += jobFilterNav(departments, locations, 'remote', hasRemote);
    remoteBody += renderJobCards(remoteJobs);

    pages['/jobs/remote'] = layout(remoteBody, {
      title: 'Remote Jobs',
      description: 'Remote roles at AI accounting companies.',
      path: '/jobs/remote',
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  // Department filter pages
  for (const dept of departments) {
    const slug = slugify(dept);
    const deptJobs = allJobs.filter(j => j.department === dept);
    let deptBody = `<h2 class="section-heading">${escapeHtml(dept)} Roles</h2>\n`;
    deptBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${deptJobs.length} role${deptJobs.length !== 1 ? 's' : ''} in ${escapeHtml(dept)}.</p>\n`;
    deptBody += jobFilterNav(departments, locations, `dept-${slug}`, hasRemote);
    deptBody += renderJobCards(deptJobs);

    pages[`/jobs/dept/${slug}`] = layout(deptBody, {
      title: `${dept} Jobs`,
      description: `${dept} roles at AI accounting companies.`,
      path: `/jobs/dept/${slug}`,
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  // Location filter pages
  for (const loc of locations) {
    const slug = slugify(loc);
    const locJobs = allJobs.filter(j => j.location === loc);
    let locBody = `<h2 class="section-heading">Roles in ${escapeHtml(loc)}</h2>\n`;
    locBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${locJobs.length} role${locJobs.length !== 1 ? 's' : ''} in ${escapeHtml(loc)}.</p>\n`;
    locBody += jobFilterNav(departments, locations, `loc-${slug}`, hasRemote);
    locBody += renderJobCards(locJobs);

    pages[`/jobs/location/${slug}`] = layout(locBody, {
      title: `Jobs in ${loc}`,
      description: `AI accounting roles in ${loc}.`,
      path: `/jobs/location/${slug}`,
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  return pages;
}
