/**
 * Page generators for agenticaiccounting.com
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
  signalStrip,
  type LayoutOptions,
} from './html';
import { diversifyFeatured, diversifyFeed } from './diversity';
import { CATEGORIES, getCategoryBySlug } from '../categories';
import { renderJobPostingsJsonLd } from './jobposting-schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTICLES_PER_PAGE = 20;
const JOBS_PER_PAGE = 25;
const SITE_URL = 'https://agenticaiccounting.com';

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

/** Generate a context-aware description for a company if one is missing. */
function generateCompanyDescription(company: Company): string {
  if (company.description) {
    return company.description;
  }

  // Build a fallback description from available metadata
  const parts: string[] = [];
  const name = company.name;

  if (company.category) {
    parts.push(`${name} is a company in the ${company.category} space`);
  } else {
    parts.push(`${name} is an AI-powered accounting solution`);
  }

  if (company.articleCount && company.articleCount > 0) {
    parts.push(` with ${company.articleCount} article${company.articleCount !== 1 ? 's' : ''} covering its platform and developments`);
  } else {
    parts.push(' helping with AI and accounting workflows');
  }

  if (company.fundingStage) {
    parts.push(`. ${name} is a ${company.fundingStage.toLowerCase()} company`);
  }

  return parts.join('').trim() + '.';
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

  // Signal strip — key metrics directly under hero
  body += signalStrip({
    sources: stats ? stats.sources : 0,
    articles: stats ? stats.articles : 0,
    companies: companies ? companies.length : 0,
    jobs: totalJobs,
  });

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
    body += `<h3 class="spotlight-heading">Trending This Week</h3>`;
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
      body += `<h3 class="spotlight-heading">Latest Insight</h3>`;
      body += insightCard(latestInsight);
      if (insights.length > 1) {
        body += `<div class="view-all"><a href="/resources">View all digests &rarr;</a></div>`;
      }
      body += `</div>\n`;
    } else {
      // Company spotlight instead
      if (companies && companies.length > 0) {
        const topCompanies = [...companies]
          .sort((a, b) => b.articleCount - a.articleCount)
          .slice(0, 4);
        body += `<div class="spotlight-card">`;
        body += `<h3 class="spotlight-heading">Top Companies</h3>`;
        for (const c of topCompanies) {
          body += `<div class="spotlight-item">
  <a href="/company/${escapeHtml(c.id)}" class="spotlight-item-link">${escapeHtml(c.name)}</a>
  <span class="spotlight-item-count">${c.articleCount} articles</span>
</div>\n`;
        }
        body += `<div class="view-all"><a href="/companies">View all companies &rarr;</a></div>`;
        body += `</div>\n`;
      }
    }
    body += `</div>\n`;
  }

  // Jobs preview section — latest open roles
  if (companyJobs && companyJobs.size > 0) {
    // Collect all jobs and sort by postedAt (most recent first)
    const allJobs: Array<CompanyJob & { companyName: string }> = [];
    for (const [companyId, jobs] of companyJobs.entries()) {
      const company = companies?.find(c => c.id === companyId);
      const companyName = company?.name ?? 'Unknown Company';
      for (const job of jobs) {
        allJobs.push({ ...job, companyName });
      }
    }
    
    // Sort by postedAt descending (most recent first), fallback to lastSeenAt
    allJobs.sort((a, b) => {
      const aDate = a.postedAt ? new Date(a.postedAt).getTime() : new Date(a.lastSeenAt).getTime();
      const bDate = b.postedAt ? new Date(b.postedAt).getTime() : new Date(b.lastSeenAt).getTime();
      return bDate - aDate;
    });
    
    const previewJobs = allJobs.slice(0, 5);
    if (previewJobs.length > 0) {
      body += `<div class="section-label"><a href="/jobs" style="color:inherit;text-decoration:none;">Open Roles</a></div>\n`;
      body += `<div class="jobs-preview-grid">\n`;
      for (const job of previewJobs) {
        const remoteBadge = job.isRemote ? `<span class="job-tag remote">Remote</span>` : '';
        const locationBadge = job.location ? `<span class="job-tag">${escapeHtml(job.location)}</span>` : '';
        body += `<div class="job-preview-card">
  <h3><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></h3>
  <div class="job-company">${escapeHtml(job.companyName)}</div>
  <div class="job-tags">${remoteBadge}${locationBadge}</div>
</div>\n`;
      }
      body += `</div>\n`;
      body += `<div class="view-all"><a href="/jobs">View all jobs &rarr;</a></div>\n`;
    }
  }

  // Latest section — time-grouped with inline tag filter (demoted visual hierarchy)
  body += `<div class="latest-feed">\n`;
  body += `<div class="section-label-row"><div class="section-label">Latest</div>${tagNav('', tagsWithArticles)}</div>\n`;
  if (latestPages.length > 0) {
    body += renderTimeGrouped(latestPages[0]);
  } else {
    body += `<p class="empty-state">No articles yet. Check back soon.</p>`;
  }
  body += pagination(1, totalPages);
  body += `</div>\n`;

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
  layoutOpts: Partial<LayoutOptions>,
  companies?: Company[]
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

    // Extract companies mentioned in articles with this tag
    const companiesForTag = new Set<string>();
    for (const article of filtered) {
      if (article.companyMentions) {
        for (const mention of article.companyMentions) {
          companiesForTag.add(mention);
        }
      }
    }
    
    // Get top companies (by mention count or article relevance)
    const topCompaniesForTag: Company[] = [];
    if (companies && companiesForTag.size > 0) {
      const companyMentionCount = new Map<string, number>();
      for (const mention of companiesForTag) {
        const count = companyMentionCount.get(mention) || 0;
        companyMentionCount.set(mention, count + 1);
      }
      
      const sortedCompanies = [...(companies || [])]
        .filter(c => companiesForTag.has(c.id))
        .sort((a, b) => (companyMentionCount.get(b.id) || 0) - (companyMentionCount.get(a.id) || 0))
        .slice(0, 5);
      
      topCompaniesForTag.push(...sortedCompanies);
    }

    // Page 1
    let body = `<div class="section-label-row"><div class="section-label">Latest</div>${tagNav(tag, tagsWithArticles)}</div>\n`;
    
    // Add featured companies section for tags with company mentions
    if (topCompaniesForTag.length > 0) {
      body += `<div class="section-label">Featured Companies</div>\n`;
      body += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;margin-bottom:1.5rem;">\n`;
      for (const comp of topCompaniesForTag) {
        body += `<a href="/company/${escapeHtml(comp.id)}" style="padding:0.75rem;border:1px solid var(--border);border-radius:0.25rem;text-decoration:none;color:inherit;transition:background-color 0.2s;display:block;"><div style="font-weight:600;color:var(--accent);">${escapeHtml(comp.name)}</div><div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.25rem;">${comp.category || 'AI Accounting'}</div></a>\n`;
      }
      body += `</div>\n`;
    }
    
    if (tagPages.length > 0) {
      body += renderTimeGrouped(tagPages[0]);
    } else {
      body += `<p class="empty-state">No articles for this tag yet.</p>`;
    }
    body += pagination(1, totalPages, basePath);

    const tagJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} — Articles`,
      'url': `https://agenticaiccounting.com${basePath}`,
      'description': `Articles about ${tagLabel} in AI-powered accounting.`,
      'publisher': {
        '@type': 'Organization',
        'name': 'Agentic AI Accounting',
        'url': 'https://agenticaiccounting.com',
        'logo': { '@type': 'ImageObject', 'url': 'https://agenticaiccounting.com/og.png' },
      },
    };

    pages[basePath] = layout(body, {
      title: `${tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} — Articles`,
      description: `Articles about ${tagLabel} in AI-powered accounting.`,
      path: basePath,
      activeTag: tag,
      activeTab: 'news',
      noindex: filtered.length < 5,
      jsonLd: tagJsonLd,
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
    <a href="mailto:hello@agenticaiccounting.com">hello@agenticaiccounting.com</a>.
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
      a: 'Yes! We\'re always looking to expand our coverage. Send the source URL or company name to <a href="mailto:hello@agenticaiccounting.com">hello@agenticaiccounting.com</a> and we\'ll evaluate it for inclusion.',
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
      a: 'Agentic AI Accounting is an independent project. The entire pipeline — collection, scoring, company tracking, and publishing — is automated. There is no editorial staff. Questions or feedback? Reach us at <a href="mailto:hello@agenticaiccounting.com">hello@agenticaiccounting.com</a>.',
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
  totalJobPages: number,
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
  urls += `  <url><loc>${SITE_URL}/categories</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/map</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/jobs</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
  for (let i = 2; i <= totalJobPages; i++) {
    urls += `  <url><loc>${SITE_URL}/jobs/page/${i}</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>\n`;
  }
  urls += `  <url><loc>${SITE_URL}/resources</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/guide/what-is-agentic-ai</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/faq</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
  urls += `  <url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;

  // Per-category landing pages from the controlled taxonomy
  for (const cat of CATEGORIES) {
    if (cat.slug === 'other') continue;
    urls += `  <url><loc>${SITE_URL}/categories/${cat.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
  }

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

  // Calculate total job pages for sitemap
  let totalJobCount = 0;
  for (const jobs of jobsMap.values()) {
    totalJobCount += jobs.length;
  }
  const totalJobPages = Math.max(Math.ceil(totalJobCount / JOBS_PER_PAGE), 1);

  const pages: Record<string, string> = {
    ...generateHomepage(featured, latest, articles, layoutOpts, companies, jobsMap, insights),
    ...generateTagPages(articles, layoutOpts, companies),
    ...generateAboutPage(layoutOpts),
    ...generateFaqPage(layoutOpts),
    ...generateGuidePages(articles, layoutOpts),
    ...generateResourcesPage(insights ?? [], layoutOpts),
  };

  if (companies && companies.length > 0) {
    const articleMap = companyArticles ?? new Map<string, Article[]>();
    const insightMap = companyInsights ?? new Map<string, CompanyInsight>();
    Object.assign(pages, generateCompaniesPage(companies, articleMap, jobsMap, layoutOpts));
    Object.assign(pages, generateCompanyDetailPages(companies, articleMap, insightMap, jobsMap, layoutOpts));
    Object.assign(pages, generateCategoriesPage(companies, articleMap, layoutOpts));
    Object.assign(pages, generateCategoryDetailPages(companies, articleMap, jobsMap, articles, layoutOpts));
    Object.assign(pages, generateMapPage(companies, articleMap, layoutOpts));
  }
  Object.assign(pages, generateJobsPage(companies ?? [], jobsMap, layoutOpts));

  pages['/og.png'] = generateOgImagePng();

  pages['/sitemap.xml'] = generateSitemap(
    articles,
    effectiveTags,
    totalLatestPages,
    totalJobPages,
    companies
  );

  return pages;
}

// ---------------------------------------------------------------------------
// Guide pages
// ---------------------------------------------------------------------------

function generateGuidePages(
  articles: Article[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  // ===========================================================================
  // Guide: What is Agentic AI?
  // ===========================================================================

  const agenticAiGuide = (): string => {
    let body = `<h2 class="section-heading">What is Agentic AI?</h2>\n`;
    body += `<p style="color:var(--text-secondary);margin-bottom:2rem;line-height:1.6;">A comprehensive guide to autonomous AI agents in accounting, tax, audit, and bookkeeping.</p>\n`;

    // Definition
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Definition</h3>\n`;
    body += `<p>Agentic AI refers to autonomous, goal-driven AI systems that behave like intelligent teammates rather than passive tools. Unlike traditional automation that follows fixed rules, agentic AI:</p>\n`;
    body += `<ul style="margin:1rem 0 1.5rem 1.5rem;">
<li><strong>Acts with purpose</strong> — pursues objectives with autonomy, learning, and real-time adaptation</li>
<li><strong>Reasons through problems</strong> — analyzes context, makes decisions, and suggests actions</li>
<li><strong>Executes workflows</strong> — handles end-to-end processes, not isolated steps</li>
<li><strong>Improves over time</strong> — learns from previous cycles and refines its approach</li>
<li><strong>Works with humans</strong> — keeps people in the loop for oversight and approval</li>
</ul>\n`;

    // Key Differences
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">How Agentic AI Differs</h3>\n`;
    body += `<div style="background:#0f766e08;border-left:4px solid #0f766e;padding:1.5rem;margin:1.5rem 0;border-radius:0.375rem;">\n`;
    body += `<p><strong>Traditional RPA (Robotic Process Automation):</strong> Follows rigid scripts; fails when conditions change.</p>\n`;
    body += `<p style="margin-top:1rem;"><strong>Generative AI (ChatGPT-style):</strong> Creates content but doesn't act autonomously; requires prompts.</p>\n`;
    body += `<p style="margin-top:1rem;"><strong>Agentic AI:</strong> Operates independently, adapts to new scenarios, executes decisions, and orchestrates multi-step workflows.</p>\n`;
    body += `</div>\n`;

    // Use Cases
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Accounting Applications</h3>\n`;
    body += `<p>Agentic AI is transforming core accounting workflows:</p>\n`;
    body += `<ul style="margin:1rem 0 1.5rem 1.5rem;">\n`;
    body += `<li><strong>Reconciliation & Close</strong> — agents match transactions across ERPs, flag discrepancies, and reconcile accounts automatically</li>\n`;
    body += `<li><strong>Invoice & Expense Processing</strong> — extract data, validate amounts, detect duplicates, and post entries without manual review</li>\n`;
    body += `<li><strong>Audit & Compliance</strong> — generate audit trails, flag control issues, and prepare workpapers in real-time</li>\n`;
    body += `<li><strong>Tax Preparation</strong> — analyze transactions, categorize for tax rules, and generate returns or schedules</li>\n`;
    body += `<li><strong>Financial Analysis</strong> — monitor variances, detect anomalies, and explain discrepancies with context</li>\n`;
    body += `</ul>\n`;

    // Benefits
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Key Benefits</h3>\n`;
    body += `<ul style="margin:1rem 0 1.5rem 1.5rem;">\n`;
    body += `<li><strong>Reduced manual effort</strong> — finance teams shift from execution to review and strategy</li>\n`;
    body += `<li><strong>Faster cycles</strong> — month-end close times drop from weeks to days</li>\n`;
    body += `<li><strong>Better accuracy</strong> — agents don't fatigue; they maintain consistent precision</li>\n`;
    body += `<li><strong>Scalability</strong> — handle 10x transaction volume without proportional headcount</li>\n`;
    body += `<li><strong>Continuous monitoring</strong> — real-time detection vs. batch-based reviews</li>\n`;
    body += `<li><strong>Auditability</strong> — every action logged, reversible, and explainable</li>\n`;
    body += `</ul>\n`;

    // Companies & Tools
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Leading Companies</h3>\n`;
    body += `<p>Companies building agentic AI for accounting:</p>\n`;
    body += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin:1.5rem 0;">\n`;

    const topCompanies = [
      { name: 'Basis', id: 'basis', desc: 'AI bookkeeping and financial review for CPA firms' },
      { name: 'Digits', id: 'digits', desc: 'AI-native accounting platform with real-time visibility' },
      { name: 'Stacks', id: 'stacks', desc: 'AI financial operations and automation for enterprise' },
      { name: 'Vic.ai', id: 'vic-ai', desc: 'AI-powered autonomous accounting platform' },
      { name: 'Campfire', id: 'campfire', desc: 'AI-native accounting platform with ERP integration' },
      { name: 'Suralink', id: 'suralink', desc: 'AI-powered audit workpaper automation' },
    ];

    for (const co of topCompanies) {
      body += `<div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1rem;">\n`;
      body += `<h4 style="margin:0 0 0.5rem 0;"><a href="/company/${escapeHtml(co.id)}" style="color:var(--accent);text-decoration:none;">${escapeHtml(co.name)}</a></h4>\n`;
      body += `<p style="font-size:0.875rem;color:var(--text-secondary);margin:0;">${escapeHtml(co.desc)}</p>\n`;
      body += `</div>\n`;
    }
    body += `</div>\n`;

    // Recent Insights
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Recent Coverage</h3>\n`;
    const agenticArticles = articles
      .filter(a => a.tags?.includes('agentic-ai'))
      .slice(0, 5);

    if (agenticArticles.length > 0) {
      body += `<div style="display:grid;gap:1rem;margin:1.5rem 0;">\n`;
      for (const article of agenticArticles) {
        body += `<div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1rem;">\n`;
        body += `<h4 style="margin:0 0 0.5rem 0;"><a href="/article/${escapeHtml(article.id)}" style="color:var(--accent);text-decoration:none;">${escapeHtml(article.headline || article.title)}</a></h4>\n`;
        if (article.aiSummary) {
          body += `<p style="font-size:0.875rem;color:var(--text-secondary);margin:0.5rem 0 0 0;line-height:1.5;">${escapeHtml(article.aiSummary.substring(0, 150))}...</p>\n`;
        }
        body += `<p style="font-size:0.75rem;color:#999;margin:0.75rem 0 0 0;"><a href="/tag/agentic-ai">agentic-ai</a> · <a href="/article/${escapeHtml(article.id)}">read more</a></p>\n`;
        body += `</div>\n`;
      }
      body += `</div>\n`;
    }

    // FAQ Section
    body += `<h3 style="margin-top:2.5rem;margin-bottom:1rem;">Common Questions</h3>\n`;
    body += `<details style="margin:1rem 0;border:1px solid #e5e7eb;padding:1rem;border-radius:0.375rem;">\n`;
    body += `<summary style="cursor:pointer;font-weight:500;">Will AI agents replace accountants?</summary>\n`;
    body += `<p style="margin-top:1rem;color:var(--text-secondary);">No. Agentic AI is designed to augment, not replace. Agents handle repetitive execution; accountants focus on judgment, complex analysis, and client relationships. The result is higher-value work for professionals.</p>\n`;
    body += `</details>\n`;

    body += `<details style="margin:1rem 0;border:1px solid #e5e7eb;padding:1rem;border-radius:0.375rem;">\n`;
    body += `<summary style="cursor:pointer;font-weight:500;">How does agentic AI handle compliance and audit trails?</summary>\n`;
    body += `<p style="margin-top:1rem;color:var(--text-secondary);">Every action is logged with full context: what was analyzed, what logic was applied, and what decision was made. Agents operate within pre-defined approval thresholds. Humans review exceptions. This creates the audit trail required for SOX, AICPA, and PCAOB compliance.</p>\n`;
    body += `</details>\n`;

    body += `<details style="margin:1rem 0;border:1px solid #e5e7eb;padding:1rem;border-radius:0.375rem;">\n`;
    body += `<summary style="cursor:pointer;font-weight:500;">What's the difference between agentic AI and AI-powered tools?</summary>\n`;
    body += `<p style="margin-top:1rem;color:var(--text-secondary);">AI tools assist with specific tasks (e.g., extracting invoice data). Agentic systems orchestrate entire workflows end-to-end, learning and adapting along the way. An agent doesn't just extract data—it validates, matches, flags, and sometimes even posts entries autonomously.</p>\n`;
    body += `</details>\n`;

    return body;
  };

  const guideJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Guide',
    'name': 'What is Agentic AI?',
    'url': `${SITE_URL}/guide/what-is-agentic-ai`,
    'description': 'A comprehensive guide to autonomous AI agents in accounting, tax, audit, and bookkeeping.',
    'author': {
      '@type': 'Organization',
      'name': 'Agentic AI Accounting',
      'url': SITE_URL,
    },
    'datePublished': new Date().toISOString().split('T')[0],
  };

  const guideBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_URL,
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Resources',
        'item': `${SITE_URL}/resources`,
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': 'What is Agentic AI?',
        'item': `${SITE_URL}/guide/what-is-agentic-ai`,
      },
    ],
  };

  const guideJsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [guideJsonLd, guideBreadcrumb],
  };

  pages['/guide/what-is-agentic-ai'] = layout(agenticAiGuide(), {
    title: 'What is Agentic AI? — Agentic AI Accounting',
    description: 'A comprehensive guide to autonomous AI agents and how they\'re transforming accounting, audit, tax, and bookkeeping workflows.',
    path: '/guide/what-is-agentic-ai',
    activeTab: 'resources',
    jsonLd: guideJsonLdGraph,
    ...layoutOpts,
  });

  return pages;
}

// ---------------------------------------------------------------------------
// Insights page
// ---------------------------------------------------------------------------

function generateResourcesPage(
  insights: InsightSummary[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  let body = '';

  body += `<h2 class="section-heading">Resources</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.5rem;line-height:1.6;">Insights, guides, and essential resources for understanding AI in accounting.</p>\n`;

  // Latest insight brief
  if (insights.length > 0) {
    const latest = insights[0];
    body += `<h3 class="section-label">Latest Digest</h3>\n`;
    body += `<div class="insights-grid" style="margin-bottom:1.5rem;">\n`;
    body += insightCard(latest);
    body += `</div>\n`;
    body += `<div style="margin-bottom:2rem;"><a href="/insights" style="font-size:0.85rem;font-weight:500;">See all digests &rarr;</a></div>\n`;
  }

  // Resource cards
  body += `<h3 class="section-label">Guides &amp; References</h3>\n`;
  body += `<div class="resource-grid">\n`;

  const resources = [
    {
      type: 'Guide',
      typeColor: 'background:#0f766e15;color:#0f766e;',
      title: 'What is Agentic AI?',
      desc: 'An introduction to autonomous AI agents and how they\'re being applied in accounting workflows — from data entry to complex audit procedures.',
      url: '/guide/what-is-agentic-ai',
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
    const linkAttr = (r as any).url ? ` href="${(r as any).url}"` : '';
    const isLink = (r as any).url ? 'a' : 'div';
    body += `<${isLink} class="resource-card"${linkAttr} style="${isLink === 'a' ? 'text-decoration:none;color:inherit;display:block;' : ''}">
  <span class="resource-type" style="${r.typeColor}">${r.type}</span>
  <h3>${r.title}</h3>
  <p>${r.desc}</p>
</${isLink}>\n`;
  }

  body += `</div>\n`;

  // Stay Informed
  body += `<h3 class="section-label" style="margin-top:2.5rem;">Stay Informed</h3>\n`;
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

  const pages: Record<string, string> = {
    '/resources': layout(body, {
      title: 'Resources',
      description: 'Insights, guides, and essential resources for understanding AI in accounting.',
      path: '/resources',
      activeTab: 'resources',
      ...layoutOpts,
    }),
  };

  // Full insights listing page (linked from "See all digests")
  if (insights.length > 0) {
    let insightsBody = `<h2 class="section-heading">All Digests</h2>\n`;
    insightsBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.5rem;line-height:1.6;">AI-generated summaries and analysis of the latest trends in agentic AI for accounting.</p>\n`;
    insightsBody += `<div class="insights-grid">\n`;
    for (const insight of insights) {
      insightsBody += insightCard(insight);
    }
    insightsBody += `</div>\n`;

    const insightsJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': 'AI Accounting Digests',
      'url': `${SITE_URL}/insights`,
      'description': 'AI-generated digests and analysis of trends in agentic AI for accounting.',
      'publisher': {
        '@type': 'Organization',
        'name': 'Agentic AI Accounting',
        'url': SITE_URL,
        'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/og.png` },
      },
      'hasPart': insights.map((insight, idx) => ({
        '@type': 'Article',
        'position': idx + 1,
        'name': insight.title,
        'url': `${SITE_URL}/insights/${escapeHtml(insight.periodType)}/${escapeHtml(insight.periodStart)}`,
        'description': insight.content ? insight.content.substring(0, 160) : '',
        'datePublished': insight.generatedAt,
      })),
    };

    const insightsBreadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': SITE_URL,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Resources',
          'item': `${SITE_URL}/resources`,
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': 'Digests',
          'item': `${SITE_URL}/insights`,
        },
      ],
    };

    const insightsJsonLdGraph = {
      '@context': 'https://schema.org',
      '@graph': [insightsJsonLd, insightsBreadcrumb],
    };

    pages['/insights'] = layout(insightsBody, {
      title: 'Digests',
      description: 'AI-generated digests and analysis of trends in agentic AI for accounting.',
      path: '/insights',
      activeTab: 'resources',
      jsonLd: insightsJsonLdGraph,
      ...layoutOpts,
    });
  }

  return pages;
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
      const desc = escapeHtml(generateCompanyDescription(c));
      const articleCount = companyArticles.get(c.id)?.length ?? 0;
      const jobCount = companyJobs?.get(c.id)?.length ?? 0;

      const sizeLabel = companySizeLabel(c.employeeCountMin ?? null, c.employeeCountMax ?? null);

      companyRows += `<div class="company-card">
  <h3><a href="/company/${escapeHtml(c.id)}">${name}</a></h3>
  <p class="card-desc">${desc}</p>
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

  const subNav = categoriesSubNav('companies');
  const body = companies.length === 0
    ? `<h2 class="section-heading">Companies &amp; Startups</h2>
${subNav}
<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked yet. Check back soon.</p>`
    : `
<h2 class="section-heading">Companies &amp; Startups in AI Accounting</h2>
<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:0.5rem;line-height:1.6;">
  Tracking ${companies.length} companies building AI-powered tools for accounting, audit, tax, and bookkeeping.
</p>
${subNav}
${companyRows}`;

  const companiesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'AI Accounting Companies & Startups',
    'url': `${SITE_URL}/companies`,
    'description': 'Directory of companies and startups building agentic AI for accounting, audit, tax, and bookkeeping.',
    'itemListElement': companies.slice(0, 20).map((c, idx) => ({
      '@type': 'Thing',
      'position': idx + 1,
      'name': c.name,
      'url': `${SITE_URL}/company/${c.id}`,
      'description': c.description,
    })),
  };

  const companiesBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_URL,
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Companies',
        'item': `${SITE_URL}/companies`,
      },
    ],
  };

  const companiesJsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [companiesJsonLd, companiesBreadcrumb],
  };

  return {
    '/companies': layout(body, {
      title: 'Companies',
      description: 'Companies and startups building agentic AI for accounting, audit, tax, and bookkeeping.',
      path: '/companies',
      activeTab: 'companies',
      jsonLd: companiesJsonLdGraph,
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
    const displayDescription = generateCompanyDescription(company);
    body += `<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0.5rem;">${escapeHtml(displayDescription)}</p>`;
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

    // Related companies in the same category
    if (company.category && company.categorySlug) {
      const relatedCompanies = companies.filter(c => c.categorySlug === company.categorySlug && c.id !== company.id);
      if (relatedCompanies.length > 0) {
        body += `<div class="section-label">Companies in ${escapeHtml(company.category)}</div>\n`;
        body += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.75rem;margin-bottom:2rem;">\n`;
        // Show up to 6 related companies
        const displayRelated = relatedCompanies.slice(0, 6);
        for (const relComp of displayRelated) {
          const relArticles = companyArticles.get(relComp.id) ?? [];
          const relDesc = relComp.description ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.25rem;">${escapeHtml(relComp.description)}</div>` : '';
          const relMeta = `<div style="font-size:0.8rem;color:var(--text-tertiary);margin-top:0.5rem;">${relArticles.length} article${relArticles.length !== 1 ? 's' : ''}</div>`;
          body += `<a href="/company/${escapeHtml(relComp.id)}" style="padding:0.75rem;border:1px solid var(--border);border-radius:0.25rem;text-decoration:none;color:inherit;transition:background-color 0.2s;display:block;"><div style="font-weight:600;color:var(--accent);">${escapeHtml(relComp.name)}</div>${relDesc}${relMeta}</a>\n`;
        }
        body += `</div>\n`;
        if (relatedCompanies.length > 6) {
          const categorySlug = company.categorySlug.replace(/_/g, '-');
          body += `<p style="text-align:center;margin-bottom:2rem;"><a href="/categories/${categorySlug}" style="color:var(--accent);">View all ${relatedCompanies.length} companies in ${escapeHtml(company.category)} →</a></p>\n`;
        }
      }
    }

    // Article feed
    if (articles.length > 0) {
      body += `<div class="section-label">Recent Coverage</div>\n`;
      body += renderTimeGrouped(articles);
    } else {
      body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No articles yet for ${name}. Check back soon.</p>`;
    }

    // Build Organization schema for this company
    const companyJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': company.name,
      'url': `${SITE_URL}${path}`,
      'description': generateCompanyDescription(company),
    };

    if (company.website) {
      companyJsonLd['sameAs'] = company.website;
    }

    if (company.logoUrl) {
      companyJsonLd['logo'] = {
        '@type': 'ImageObject',
        'url': company.logoUrl,
        'width': 300,
        'height': 300,
      };
    }

    if (company.employeeCountMin || company.employeeCountMax) {
      const employeesObj: Record<string, unknown> = { '@type': 'QuantitativeValue' };
      if (company.employeeCountMin) {
        employeesObj['minValue'] = company.employeeCountMin;
      }
      if (company.employeeCountMax) {
        employeesObj['maxValue'] = company.employeeCountMax;
      }
      companyJsonLd['numberOfEmployees'] = employeesObj;
    }

    if (company.category) {
      companyJsonLd['knowsAbout'] = [company.category, 'Agentic AI', 'AI Accounting'];
    }

    // Add BreadcrumbList schema for better navigation hierarchy
    const breadcrumbList = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': SITE_URL,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Companies',
          'item': `${SITE_URL}/companies`,
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': company.name,
          'item': `${SITE_URL}${path}`,
        },
      ],
    };

    // Combine Organization and BreadcrumbList into a graph
    const jsonLdGraph = {
      '@context': 'https://schema.org',
      '@graph': [companyJsonLd, breadcrumbList],
    };

    pages[path] = layout(body, {
      title: `${company.name} — Feed`,
      description: company.description || `Latest news and articles about ${company.name} in AI-powered accounting.`,
      path,
      activeTab: 'companies',
      jsonLd: jsonLdGraph,
      ...layoutOpts,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Categories: index, detail, and market map
// ---------------------------------------------------------------------------

/**
 * Bucket every company by its `categorySlug`, defaulting NULL/unknown to 'other'.
 * Returns a map keyed by slug. Categories without companies get an empty array
 * so the index page can show a stub for them too.
 */
function bucketCompaniesBySlug(companies: Company[]): Map<string, Company[]> {
  const buckets = new Map<string, Company[]>();
  for (const cat of CATEGORIES) buckets.set(cat.slug, []);
  for (const c of companies) {
    const slug = getCategoryBySlug(c.categorySlug).slug;
    buckets.get(slug)!.push(c);
  }
  return buckets;
}

/**
 * Sub-nav rendered at the top of /companies, /categories, and /map so users
 * can jump between the three views of the same data.
 */
function categoriesSubNav(active: 'companies' | 'categories' | 'map'): string {
  const items: { href: string; label: string; key: typeof active }[] = [
    { href: '/companies', label: 'All Companies', key: 'companies' },
    { href: '/categories', label: 'By Category', key: 'categories' },
    { href: '/map', label: 'Market Map', key: 'map' },
  ];
  const links = items.map(
    (i) =>
      `<a href="${i.href}" class="job-filter-btn${i.key === active ? ' active' : ''}">${i.label}</a>`
  );
  return `<nav class="job-filters">\n  ${links.join('\n  ')}\n</nav>\n`;
}

function generateCategoriesPage(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const buckets = bucketCompaniesBySlug(companies);

  // Total recent-article count per category, last 30 days.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentCounts = new Map<string, number>();
  for (const cat of CATEGORIES) {
    let total = 0;
    for (const c of buckets.get(cat.slug)!) {
      const arts = companyArticles.get(c.id) ?? [];
      for (const a of arts) {
        if (new Date(a.publishedAt).getTime() >= cutoff) total++;
      }
    }
    recentCounts.set(cat.slug, total);
  }

  let body = `<h2 class="section-heading">Categories</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${CATEGORIES.length} categories covering the AI-accounting landscape — from AI-native ERPs to firms running services on top of agents. Click any category for the companies in it and recent coverage.</p>\n`;
  body += categoriesSubNav('categories');
  body += `<div class="company-grid">\n`;

  for (const cat of CATEGORIES) {
    const cos = buckets.get(cat.slug)!;
    if (cat.slug === 'other' && cos.length === 0) continue;
    const recent = recentCounts.get(cat.slug) ?? 0;
    body += `<div class="company-card">
  <h3><a href="/categories/${cat.slug}">${escapeHtml(cat.label)}</a></h3>
  <p class="card-desc">${escapeHtml(cat.description)}</p>
  <div class="card-meta">
    <span>${cos.length} compan${cos.length === 1 ? 'y' : 'ies'}</span>
    ${recent > 0 ? `<span class="meta-dot">&middot;</span> <span>${recent} article${recent === 1 ? '' : 's'} in last 30 days</span>` : ''}
  </div>
</div>\n`;
  }
  body += `</div>\n`;

  const categoriesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'AI Accounting Categories',
    'url': `${SITE_URL}/categories`,
    'description':
      'Categorized directory of companies building agentic AI for accounting.',
  };

  const categoriesBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_URL,
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Categories',
        'item': `${SITE_URL}/categories`,
      },
    ],
  };

  const categoriesJsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [categoriesJsonLd, categoriesBreadcrumb],
  };

  return {
    '/categories': layout(body, {
      title: 'Categories',
      description:
        'Browse AI-accounting companies by category — AI-native ERPs, bookkeeping automation, AI audit, AI tax, AI-enabled firms, and more.',
      path: '/categories',
      activeTab: 'companies',
      ...layoutOpts,
      jsonLd: categoriesJsonLdGraph,
    }),
  };
}

// Mapping from category slug to tag slug for empty categories
const CATEGORY_TO_TAG_MAP: Record<string, string> = {
  'audit-automation': 'audit',
  'tax-automation': 'tax',
  'ap-automation': 'automation',
  'ar-automation': 'automation',
};

function generateCategoryDetailPages(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  companyJobs: Map<string, CompanyJob[]>,
  allArticles: Article[],
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};
  const buckets = bucketCompaniesBySlug(companies);

  for (const cat of CATEGORIES) {
    const cos = [...buckets.get(cat.slug)!].sort(
      (a, b) => b.articleCount - a.articleCount
    );
    if (cat.slug === 'other' && cos.length === 0) continue;

    let body = `<div class="section-label"><a href="/categories" style="color:var(--text-tertiary);">Categories</a> &rsaquo; ${escapeHtml(cat.label)}</div>\n`;
    body += `<h2 class="section-heading">${escapeHtml(cat.label)}</h2>\n`;
    body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${escapeHtml(cat.description)}</p>\n`;
    body += categoriesSubNav('categories');

    if (cos.length === 0) {
      // For empty categories, show recent articles tagged with the matching tag
      const tagSlug = CATEGORY_TO_TAG_MAP[cat.slug];
      if (tagSlug) {
        const matchingArticles = allArticles.filter(
          a => a.isPublished && a.tags && a.tags.includes(tagSlug)
        );
        if (matchingArticles.length > 0) {
          const recent = sortByDate(matchingArticles).slice(0, 12);
          body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;">No companies tracked yet. Below is recent coverage on this topic:</p>\n`;
          body += `<div class="section-label" style="margin-top:1rem;">Recent Coverage</div>\n`;
          body += renderTimeGrouped(recent);
        } else {
          body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked in this category yet.</p>`;
        }
      } else {
        body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No companies tracked in this category yet.</p>`;
      }
    } else {
      body += `<div class="company-grid">\n`;
      for (const c of cos) {
        const name = escapeHtml(c.name);
        const desc = c.description ? escapeHtml(c.description) : '';
        const articleCount = companyArticles.get(c.id)?.length ?? 0;
        const jobCount = companyJobs.get(c.id)?.length ?? 0;
        const sizeLabel = companySizeLabel(
          c.employeeCountMin ?? null,
          c.employeeCountMax ?? null
        );
        body += `<div class="company-card">
  <h3><a href="/company/${escapeHtml(c.id)}">${name}</a></h3>
  ${desc ? `<p class="card-desc">${desc}</p>` : ''}
  <div class="card-meta">
    <span>${articleCount} article${articleCount !== 1 ? 's' : ''}</span>
    ${jobCount > 0 ? `<span class="meta-dot">&middot;</span> <span style="color:var(--accent);">${jobCount} open role${jobCount !== 1 ? 's' : ''}</span>` : ''}
    ${sizeLabel ? `<span class="meta-dot">&middot;</span> <span>${escapeHtml(sizeLabel)}</span>` : ''}
    ${c.website ? `<span class="meta-dot">&middot;</span> <a href="${escapeHtml(c.website)}" rel="noopener" target="_blank">${escapeHtml(safeHostname(c.website))}</a>` : ''}
  </div>
</div>\n`;
      }
      body += `</div>\n`;

      // Recent coverage across all companies in this category
      const recent: Article[] = [];
      const seen = new Set<string>();
      for (const c of cos) {
        for (const a of companyArticles.get(c.id) ?? []) {
          if (!seen.has(a.id)) {
            seen.add(a.id);
            recent.push(a);
          }
        }
      }
      const recentSorted = sortByDate(recent).slice(0, 12);
      if (recentSorted.length > 0) {
        body += `<div class="section-label" style="margin-top:1.5rem;">Recent Coverage</div>\n`;
        body += renderTimeGrouped(recentSorted);
      }
    }

    const path = `/categories/${cat.slug}`;
    const catJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${cat.label} — AI Accounting Companies`,
      'url': `https://agenticaiccounting.com${path}`,
      'description': `${cat.description} ${cos.length} compan${cos.length === 1 ? 'y' : 'ies'} tracked.`,
      'publisher': {
        '@type': 'Organization',
        'name': 'Agentic AI Accounting',
        'url': 'https://agenticaiccounting.com',
        'logo': { '@type': 'ImageObject', 'url': 'https://agenticaiccounting.com/og.png' },
      },
      'itemListElement': cos.slice(0, 10).map((c, idx) => ({
        '@type': 'Thing',
        'position': idx + 1,
        'name': c.name,
        'url': `https://agenticaiccounting.com/company/${c.id}`,
        'description': c.description || undefined,
      })),
    };

    // Add BreadcrumbList schema for category detail pages
    const catBreadcrumbList = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': SITE_URL,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Categories',
          'item': `${SITE_URL}/categories`,
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': cat.label,
          'item': `${SITE_URL}${path}`,
        },
      ],
    };

    // Combine CollectionPage and BreadcrumbList into a graph
    const catJsonLdGraph = {
      '@context': 'https://schema.org',
      '@graph': [catJsonLd, catBreadcrumbList],
    };

    pages[path] = layout(body, {
      title: `${cat.label} — AI Accounting Companies`,
      description: `${cat.description} ${cos.length} compan${cos.length === 1 ? 'y' : 'ies'} tracked.`,
      path,
      activeTab: 'companies',
      noindex: cos.length === 0,
      jsonLd: catJsonLdGraph,
      ...layoutOpts,
    });
  }

  return pages;
}

/**
 * /map — a static market map. Categories are rows; companies are chips
 * sized by article_count (proxy for coverage volume). Pure CSS grid; no JS.
 */
function generateMapPage(
  companies: Company[],
  companyArticles: Map<string, Article[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const buckets = bucketCompaniesBySlug(companies);

  let body = `<h2 class="section-heading">The AI Accounting Market Map</h2>\n`;
  body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${companies.length} companies across ${CATEGORIES.length} categories building agentic AI for accounting, audit, tax, and bookkeeping. Chip size scales with coverage volume — bigger chips mean more articles tracked.</p>\n`;
  body += categoriesSubNav('map');

  // Compute max article count for scaling
  let maxArticles = 1;
  for (const c of companies) {
    if (c.articleCount > maxArticles) maxArticles = c.articleCount;
  }

  body += `<div class="market-map">\n`;
  for (const cat of CATEGORIES) {
    const cos = [...buckets.get(cat.slug)!].sort(
      (a, b) => b.articleCount - a.articleCount
    );
    if (cos.length === 0 && cat.slug === 'other') continue;
    body += `<div class="market-map-row">\n`;
    body += `<div class="market-map-label"><a href="/categories/${cat.slug}">${escapeHtml(cat.label)}</a><span class="market-map-count">${cos.length}</span></div>\n`;
    body += `<div class="market-map-cells">\n`;
    if (cos.length === 0) {
      body += `<span class="market-map-empty">No companies tracked yet.</span>\n`;
    } else {
      for (const c of cos) {
        // 4 size buckets so the map reads at a glance
        const ratio = c.articleCount / maxArticles;
        const size =
          ratio > 0.5 ? 'xl' : ratio > 0.25 ? 'lg' : ratio > 0.05 ? 'md' : 'sm';
        const recent = (companyArticles.get(c.id)?.length ?? 0);
        const title = `${c.name} — ${c.articleCount} article${c.articleCount === 1 ? '' : 's'} tracked${recent > 0 ? `, ${recent} recent` : ''}`;
        body += `<a class="market-map-chip ${size}" href="/company/${escapeHtml(c.id)}" title="${escapeHtml(title)}">${escapeHtml(c.name)}</a>\n`;
      }
    }
    body += `</div>\n</div>\n`;
  }
  body += `</div>\n`;

  body += `<p style="color:var(--text-tertiary);font-size:0.78rem;margin-top:1.5rem;text-align:center;">Tracking ${companies.length} companies. Updated hourly.</p>\n`;

  return {
    '/map': layout(body, {
      title: 'Market Map',
      description:
        'A live market map of companies building agentic AI for accounting — categorized and sized by coverage. Updated hourly.',
      path: '/map',
      activeTab: 'companies',
      ...layoutOpts,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            'name': 'AI Accounting Market Map',
            'url': `${SITE_URL}/map`,
            'description':
              'Live market map of AI-accounting companies, categorized and sized by recent coverage volume.',
          },
          {
            '@type': 'BreadcrumbList',
            'itemListElement': [
              {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Home',
                'item': SITE_URL,
              },
              {
                '@type': 'ListItem',
                'position': 2,
                'name': 'Market Map',
                'item': `${SITE_URL}/map`,
              },
            ],
          },
        ],
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Jobs page
// ---------------------------------------------------------------------------

type EnrichedJob = CompanyJob & { companyName: string; companyId: string };

/** Slugify a string for URL use. */
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Render a dropdown filter for job pages. */
function filterDropdown(
  label: string,
  items: { href: string; text: string; active: boolean }[]
): string {
  if (items.length === 0) return '';
  const hasActive = items.some(i => i.active);
  const activeItem = items.find(i => i.active);
  const displayLabel = activeItem ? activeItem.text : label;
  const arrow = '&#9662;';
  let html = `<details class="job-dropdown">\n`;
  html += `  <summary${hasActive ? ' class="has-active"' : ''}>${displayLabel} ${arrow}</summary>\n`;
  html += `  <div class="dropdown-menu">\n`;
  for (const item of items) {
    html += `    <a href="${item.href}"${item.active ? ' class="active"' : ''}>${item.text}</a>\n`;
  }
  html += `  </div>\n`;
  html += `</details>\n`;
  return html;
}

/** Render distinct filter groups for job pages. */
function jobFilterNav(
  departments: string[],
  locations: string[],
  companyNames: { id: string; name: string }[],
  activeFilter: string,
  hasRemote: boolean
): string {
  let html = `<nav class="job-filters">\n`;

  // All Jobs / Remote buttons
  html += `  <a href="/jobs" class="job-filter-btn${activeFilter === '' ? ' active' : ''}">All Jobs</a>\n`;
  if (hasRemote) {
    html += `  <a href="/jobs/remote" class="job-filter-btn${activeFilter === 'remote' ? ' active' : ''}">Remote</a>\n`;
  }

  // Role dropdown
  html += filterDropdown('Role', departments.map(dept => {
    const slug = slugify(dept);
    return { href: `/jobs/dept/${slug}`, text: escapeHtml(dept), active: activeFilter === `dept-${slug}` };
  }));

  // Location dropdown
  html += filterDropdown('Location', locations.map(loc => {
    const slug = slugify(loc);
    return { href: `/jobs/location/${slug}`, text: escapeHtml(loc), active: activeFilter === `loc-${slug}` };
  }));

  // Company dropdown
  html += filterDropdown('Company', companyNames.map(c => {
    const slug = slugify(c.id);
    return { href: `/jobs/company/${slug}`, text: escapeHtml(c.name), active: activeFilter === `company-${slug}` };
  }));

  html += `</nav>\n`;
  return html;
}

/** Render job cards as a flat chronological list (most recent first). */
function renderJobCards(jobs: EnrichedJob[]): string {
  if (jobs.length === 0) {
    return `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No matching jobs found.</p>`;
  }

  let body = `<div class="job-grid">\n`;
  for (const job of jobs) {
    const remoteBadge = job.isRemote ? `<span class="job-tag remote">Remote</span>` : '';
    const locationBadge = job.location ? `<span class="job-tag">${escapeHtml(job.location)}</span>` : '';
    const deptBadge = job.department ? `<span class="job-tag">${escapeHtml(job.department)}</span>` : '';

    body += `<div class="job-card">
  <h3><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></h3>
  <div class="job-company"><a href="/company/${escapeHtml(job.companyId)}">${escapeHtml(job.companyName)}</a></div>
  <div class="job-tags">${remoteBadge}${locationBadge}${deptBadge}</div>
</div>\n`;
  }
  body += `</div>\n`;

  return body;
}

function generateJobsPage(
  companies: Company[],
  companyJobs: Map<string, CompanyJob[]>,
  layoutOpts: Partial<LayoutOptions>
): Record<string, string> {
  const pages: Record<string, string> = {};

  // Create company map for JobPosting schema generation
  const companyMap = new Map(companies.map(c => [c.id, c]));

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

  // Collect companies sorted by job count
  const companiesWithJobs = companies.filter(c => (companyJobs.get(c.id) ?? []).length > 0);
  const companiesByJobCount = companiesWithJobs
    .map(c => ({ id: c.id, name: c.name, count: (companyJobs.get(c.id) ?? []).length }))
    .sort((a, b) => b.count - a.count);
  const companyFilterList = companiesByJobCount.map(c => ({ id: c.id, name: c.name }));

  const filterNav = jobFilterNav(departments, locations, companyFilterList, '', hasRemote);

  // Main /jobs page (all jobs) - paginated
  const jobPages = paginate(allJobs, JOBS_PER_PAGE);
  const totalJobPages = jobPages.length;

  for (let i = 0; i < jobPages.length; i++) {
    let body = '';
    if (allJobs.length === 0) {
      body += `<h2 class="section-heading">Open Roles in AI Accounting</h2>\n`;
      body += filterNav;
      body += `<p style="color:var(--text-tertiary);padding:2rem 0;text-align:center;">No job listings yet. Check back soon.</p>`;
    } else {
      body += `<h2 class="section-heading">Open Roles in AI Accounting</h2>\n`;
      body += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${allJobs.length} open role${allJobs.length !== 1 ? 's' : ''} across ${companiesWithJobs.length} companies building the future of AI-powered accounting.</p>\n`;
      body += filterNav;
      body += renderJobCards(jobPages[i]);
      // Add JobPosting schema for all jobs on this page
      body += renderJobPostingsJsonLd(jobPages[i], companyMap);
      if (totalJobPages > 1) {
        const pageNum = i + 1;
        body += `<div style="display:flex;justify-content:center;gap:0.5rem;margin-top:2rem;flex-wrap:wrap;align-items:center;">`;
        if (i > 0) {
          body += `<a href="${i === 1 ? '/jobs' : `/jobs/page/${i}`}" style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:4px;text-decoration:none;color:var(--accent);">← Previous</a>`;
        }
        body += `<span style="color:var(--text-secondary);">Page ${pageNum} of ${totalJobPages}</span>`;
        if (i < jobPages.length - 1) {
          body += `<a href="/jobs/page/${pageNum + 1}" style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:4px;text-decoration:none;color:var(--accent);">Next →</a>`;
        }
        body += `</div>`;
      }
    }

    const path = i === 0 ? '/jobs' : `/jobs/page/${i + 1}`;
    pages[path] = layout(body, {
      title: totalJobPages > 1 && i > 0 ? `Jobs — Page ${i + 1}` : 'Jobs',
      description: 'Open roles at companies building agentic AI for accounting, audit, tax, and bookkeeping.',
      path,
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  // Remote filter page
  if (hasRemote) {
    const remoteJobs = allJobs.filter(j => j.isRemote);
    let remoteBody = `<h2 class="section-heading">Remote Roles in AI Accounting</h2>\n`;
    remoteBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${remoteJobs.length} remote role${remoteJobs.length !== 1 ? 's' : ''} available.</p>\n`;
    remoteBody += jobFilterNav(departments, locations, companyFilterList, 'remote', hasRemote);
    remoteBody += renderJobCards(remoteJobs);
    // Add JobPosting schema for remote jobs
    remoteBody += renderJobPostingsJsonLd(remoteJobs, companyMap);

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
    deptBody += jobFilterNav(departments, locations, companyFilterList, `dept-${slug}`, hasRemote);
    deptBody += renderJobCards(deptJobs);
    // Add JobPosting schema for department jobs
    deptBody += renderJobPostingsJsonLd(deptJobs, companyMap);

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
    locBody += jobFilterNav(departments, locations, companyFilterList, `loc-${slug}`, hasRemote);
    locBody += renderJobCards(locJobs);
    // Add JobPosting schema for location jobs
    locBody += renderJobPostingsJsonLd(locJobs, companyMap);

    pages[`/jobs/location/${slug}`] = layout(locBody, {
      title: `Jobs in ${loc}`,
      description: `AI accounting roles in ${loc}.`,
      path: `/jobs/location/${slug}`,
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  // Company filter pages
  for (const c of companiesByJobCount) {
    const slug = slugify(c.id);
    const cJobs = allJobs.filter(j => j.companyId === c.id);
    let cBody = `<h2 class="section-heading">${escapeHtml(c.name)} Roles</h2>\n`;
    cBody += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem;line-height:1.6;">${cJobs.length} open role${cJobs.length !== 1 ? 's' : ''} at ${escapeHtml(c.name)}.</p>\n`;
    cBody += jobFilterNav(departments, locations, companyFilterList, `company-${slug}`, hasRemote);
    cBody += renderJobCards(cJobs);
    // Add JobPosting schema for company jobs
    cBody += renderJobPostingsJsonLd(cJobs, companyMap);

    pages[`/jobs/company/${slug}`] = layout(cBody, {
      title: `${c.name} Jobs`,
      description: `Open roles at ${c.name}.`,
      path: `/jobs/company/${slug}`,
      activeTab: 'jobs',
      ...layoutOpts,
    });
  }

  return pages;
}
