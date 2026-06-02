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
  it('promotes market signals, filters non-market entities, and labels job focus', () => {
    const basis = company({});
    const reuters = company({
      id: 'reuters',
      name: 'Reuters',
      website: 'https://reuters.com',
      category: 'Media',
      categorySlug: 'other',
      articleCount: 10,
    });
    const basisArticle = article();
    const reutersArticle = article({
      id: 'reuters-roundup',
      title: 'Reuters market roundup',
      headline: 'Reuters market roundup',
      companyMentions: ['reuters'],
    });

    const pages = generateAllPages(
      [basisArticle],
      [basisArticle],
      ['automation', 'product-launch'],
      { sources: 100, crawled: 500, articles: 1, lastUpdated: new Date().toISOString() },
      [basis, reuters],
      new Map([
        ['basis', [basisArticle]],
        ['reuters', [reutersArticle]],
      ]),
      undefined,
      new Map([
        ['basis', [job()]],
        ['reuters', [job({ id: 'job-2', companyId: 'reuters', title: 'News Editor' })]],
      ])
    );

    expect(pages['/']).toContain('Signal Ledger');
    expect(pages['/']).toContain('Shipping');
    expect(pages['/']).toContain('Coverage');
    expect(pages['/']).toContain('Hiring');
    expect(pages['/']).toContain('/company/basis');
    expect(pages['/']).not.toContain('/company/reuters');

    expect(pages['/companies']).toContain('Basis');
    expect(pages['/companies']).not.toContain('Reuters');

    expect(pages['/jobs']).toContain('Jobs at AI Accounting Companies');
    expect(pages['/jobs']).toContain('Accounting/finance');
    expect(pages['/jobs']).not.toContain('News Editor');

    expect(pages['/sitemap.xml']).toContain('/company/basis');
    expect(pages['/sitemap.xml']).not.toContain('/company/reuters');
  });
});
