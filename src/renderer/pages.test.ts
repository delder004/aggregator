import { describe, expect, it } from 'vitest';
import { generateAllPages } from './pages';
import type { Article, Company, CompanyJob } from '../types';

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: 'basis-launch',
    url: 'https://example.com/basis-launch',
    title: 'Basis ships accounting automation',
    headline: 'Basis ships accounting automation',
    sourceType: 'rss',
    sourceName: 'Example News',
    author: null,
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    contentSnippet: null,
    imageUrl: null,
    relevanceScore: 80,
    qualityScore: 70,
    aiSummary: 'Basis released a new accounting automation workflow.',
    tags: ['automation', 'product-launch'],
    isPublished: true,
    socialScore: null,
    commentCount: null,
    companyMentions: ['basis'],
    transcript: null,
    transcriptSummary: null,
    ...overrides,
  };
}

function company(overrides: Partial<Company>): Company {
  return {
    id: 'basis',
    name: 'Basis',
    aliases: [],
    website: 'https://example.com',
    description: null,
    category: 'AI Bookkeeping & Close',
    categorySlug: 'ai-bookkeeping',
    fundingStage: null,
    logoUrl: null,
    isActive: true,
    addedAt: '2026-01-01T00:00:00Z',
    lastMentionedAt: new Date().toISOString(),
    articleCount: 1,
    jobsBoardType: null,
    jobsBoardToken: null,
    ...overrides,
  };
}

function job(overrides: Partial<CompanyJob> = {}): CompanyJob {
  return {
    id: 'job-1',
    companyId: 'basis',
    title: 'Senior Accountant',
    department: 'Finance',
    location: 'Remote',
    url: 'https://example.com/jobs/1',
    postedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    isRemote: true,
    ...overrides,
  };
}

describe('generateAllPages market positioning', () => {
  it('promotes the signal ledger, filters non-market entities, and labels job focus', () => {
    const basis = company({});
    const reuters = company({
      id: 'reuters',
      name: 'Reuters',
      website: 'https://reuters.com',
      category: 'Media',
      categorySlug: 'other',
      articleCount: 10,
    });
    const basisArticle = article({ tags: ['audit', 'product-launch'] });
    const automationArticle = article({
      id: 'basis-close-automation',
      url: 'https://example.com/basis-close-automation',
      title: 'Basis automates month-end close',
      headline: 'Basis automates month-end close',
      tags: ['bookkeeping'],
    });
    const reutersArticle = article({
      id: 'reuters-roundup',
      title: 'Reuters market roundup',
      headline: 'Reuters market roundup',
      companyMentions: ['reuters'],
    });

    const pages = generateAllPages(
      [basisArticle, automationArticle],
      [basisArticle],
      ['audit', 'product-launch', 'bookkeeping'],
      { sources: 100, crawled: 500, articles: 2, lastUpdated: new Date().toISOString() },
      [basis, reuters],
      new Map([
        ['basis', [basisArticle, automationArticle]],
        ['reuters', [reutersArticle]],
      ]),
      undefined,
      new Map([
        ['basis', [job()]],
        ['reuters', [job({ id: 'job-2', companyId: 'reuters', title: 'News Editor' })]],
      ])
    );

    const homepage = pages['/'];

    expect(homepage).toContain('Signal Ledger');
    expect(homepage).toContain('Shipping');
    expect(homepage).toContain('Automating');
    expect(homepage).toContain('Coverage');
    expect(homepage).toContain('Hiring');
    expect(homepage).toContain('Basis automates month-end close');
    expect(homepage).not.toContain('Work Being Automated');
    expect(homepage).not.toContain('Most Covered');
    expect(homepage).toContain('<div class="section-label">The Wire</div>');
    expect(homepage).not.toContain('<div class="section-label">Latest</div>');
    expect(homepage).toContain('/company/basis');
    expect(homepage).not.toContain('/company/reuters');

    const ledgerIndex = homepage.indexOf('Signal Ledger');
    const whatChangedIndex = homepage.indexOf('What Changed This Week');
    const featuredIndex = homepage.indexOf('Featured Stories');
    const byNumbersIndex = homepage.indexOf('Coverage breakdown');
    expect(ledgerIndex).toBeGreaterThanOrEqual(0);
    expect(whatChangedIndex).toBeGreaterThan(ledgerIndex);
    expect(featuredIndex).toBeGreaterThan(whatChangedIndex);
    expect(byNumbersIndex).toBeGreaterThan(featuredIndex);

    expect(pages['/tag/bookkeeping']).toContain('<div class="section-label">The Wire</div>');

    expect(pages['/companies']).toContain('Basis');
    expect(pages['/companies']).not.toContain('Reuters');

    expect(pages['/jobs']).toContain('Jobs at AI Accounting Companies');
    expect(pages['/jobs']).toContain('Accounting/finance');
    expect(pages['/jobs']).not.toContain('News Editor');

    expect(pages['/sitemap.xml']).toContain('/company/basis');
    expect(pages['/sitemap.xml']).not.toContain('/company/reuters');
  });
});
