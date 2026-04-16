/**
 * Seed competitor list for weekly content snapshots.
 *
 * Two buckets:
 *   - Direct: competitors or adjacent publications covering AI in
 *     accounting / finance. Content diff tells us what topics they're
 *     covering that we're missing (or vice versa).
 *   - Layout: aggregators or newsletters with well-trodden layouts.
 *     Phase 2 design-diff (screenshots + vision) will compare these
 *     against our pages.
 *
 * Operator should prune/expand as the competitive landscape shifts. The
 * list must stay under COMPETITOR_BUDGET.maxCompetitors (10).
 */

export interface CompetitorConfig {
  slug: string;
  name: string;
  homepageUrl: string;
  rssUrl: string | null;
  bucket: 'direct' | 'layout';
}

export const COMPETITORS: readonly CompetitorConfig[] = [
  {
    slug: 'jason-staats',
    name: 'Jason Staats (Realize)',
    homepageUrl: 'https://jasonstaats.com/',
    rssUrl: null,
    bucket: 'direct',
  },
  {
    slug: 'earmark',
    name: 'Earmark (Blake Oliver)',
    homepageUrl: 'https://earmarkcpe.com/articles',
    rssUrl: 'https://earmarkcpe.com/feed',
    bucket: 'direct',
  },
  {
    slug: 'accounting-today-tech',
    name: 'Accounting Today - Technology',
    homepageUrl: 'https://www.accountingtoday.com/technology',
    rssUrl: 'https://feeds.arizent.com/accountingtoday/technology',
    bucket: 'direct',
  },
  {
    slug: 'cpa-trendlines',
    name: 'CPA Trendlines',
    homepageUrl: 'https://cpatrendlines.com/',
    rssUrl: 'https://cpatrendlines.com/feed/',
    bucket: 'direct',
  },
  {
    slug: 'tldr-ai',
    name: 'TLDR AI',
    homepageUrl: 'https://tldr.tech/ai',
    rssUrl: null,
    bucket: 'layout',
  },
  {
    slug: 'bens-bites',
    name: "Ben's Bites",
    homepageUrl: 'https://bensbites.com/',
    rssUrl: null,
    bucket: 'layout',
  },
  {
    slug: 'hacker-news',
    name: 'Hacker News',
    homepageUrl: 'https://news.ycombinator.com/',
    rssUrl: null,
    bucket: 'layout',
  },
  {
    slug: 'techmeme',
    name: 'Techmeme',
    homepageUrl: 'https://techmeme.com/',
    rssUrl: 'https://techmeme.com/feed.xml',
    bucket: 'layout',
  },
];
