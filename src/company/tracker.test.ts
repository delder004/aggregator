import { describe, it, expect } from 'vitest';
import {
  getTrackedCompanies,
  upsertCompany,
  matchArticleToCompanies,
  linkArticleToCompanies,
  updateCompanyStats,
  getArticlesForCompany,
  seedDefaultCompanies,
  discoverNewCompanies,
} from './tracker';
import type { Company, ScoredArticle } from '../types';

describe('tracker module exports', () => {
  it('should export getTrackedCompanies function', () => {
    expect(typeof getTrackedCompanies).toBe('function');
  });

  it('should export upsertCompany function', () => {
    expect(typeof upsertCompany).toBe('function');
  });

  it('should export matchArticleToCompanies function', () => {
    expect(typeof matchArticleToCompanies).toBe('function');
  });

  it('should export linkArticleToCompanies function', () => {
    expect(typeof linkArticleToCompanies).toBe('function');
  });

  it('should export updateCompanyStats function', () => {
    expect(typeof updateCompanyStats).toBe('function');
  });

  it('should export getArticlesForCompany function', () => {
    expect(typeof getArticlesForCompany).toBe('function');
  });

  it('should export seedDefaultCompanies function', () => {
    expect(typeof seedDefaultCompanies).toBe('function');
  });
});

describe('matchArticleToCompanies', () => {
  const companies: Company[] = [
    {
      id: 'intuit',
      name: 'Intuit',
      aliases: ['QuickBooks', 'QuickBooks AI'],
      website: 'https://www.intuit.com',
      description: 'Financial software',
      category: null,
      categorySlug: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: '2026-01-01T00:00:00Z',
      articleCount: 0,
      lastMentionedAt: null,
      jobsBoardType: null,
      jobsBoardToken: null,
    },
    {
      id: 'xero',
      name: 'Xero',
      aliases: [],
      website: 'https://www.xero.com',
      description: 'Cloud accounting',
      category: null,
      categorySlug: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: '2026-01-01T00:00:00Z',
      articleCount: 0,
      lastMentionedAt: null,
      jobsBoardType: null,
      jobsBoardToken: null,
    },
    {
      id: 'vic-ai',
      name: 'Vic.ai',
      aliases: ['Vic AI', 'VicAI'],
      website: 'https://www.vic.ai',
      description: 'AI accounting',
      category: null,
      categorySlug: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: '2026-01-01T00:00:00Z',
      articleCount: 0,
      lastMentionedAt: null,
      jobsBoardType: null,
      jobsBoardToken: null,
    },
    {
      id: 'sage',
      name: 'Sage',
      aliases: ['Sage Intacct'],
      website: 'https://www.sage.com',
      description: 'Business software',
      category: null,
      categorySlug: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: '2026-01-01T00:00:00Z',
      articleCount: 0,
      lastMentionedAt: null,
      jobsBoardType: null,
      jobsBoardToken: null,
    },
  ];

  function makeArticle(overrides: Partial<ScoredArticle> = {}): ScoredArticle {
    return {
      url: 'https://example.com/article',
      title: 'Test Article',
      sourceType: 'rss',
      sourceName: 'Test',
      author: null,
      publishedAt: new Date().toISOString(),
      contentSnippet: null,
      imageUrl: null,
      relevanceScore: 80,
      qualityScore: 60,
      aiSummary: '',
      headline: '',
      tags: [],
      companyMentions: [],
      ...overrides,
    };
  }

  it('should match article by company name in title', () => {
    const article = makeArticle({
      title: 'Intuit Launches New AI Feature for QuickBooks',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('intuit');
  });

  it('should match article by alias', () => {
    const article = makeArticle({
      title: 'QuickBooks AI Gets Major Update',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('intuit');
  });

  it('should match article by content snippet', () => {
    const article = makeArticle({
      title: 'New Accounting Software Review',
      contentSnippet: 'In this review we look at Xero and its latest features.',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('xero');
  });

  it('should match article by AI summary', () => {
    const article = makeArticle({
      title: 'Industry Overview',
      aiSummary: 'Vic.ai continues to lead in autonomous accounting.',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('vic-ai');
  });

  it('should match multiple companies', () => {
    const article = makeArticle({
      title: 'Intuit and Xero Battle for Cloud Accounting Dominance',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('intuit');
    expect(matched).toContain('xero');
  });

  it('should return empty array when no companies match', () => {
    const article = makeArticle({
      title: 'General News About Nothing Related',
      contentSnippet: 'This article is about unrelated topics.',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toEqual([]);
  });

  it('should not match partial name for short company names', () => {
    // "Sage" should not match "message" because of word boundary check
    const article = makeArticle({
      title: 'New message system launched',
      contentSnippet: 'A messaging platform for businesses.',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).not.toContain('sage');
  });

  it('should match Sage Intacct alias', () => {
    const article = makeArticle({
      title: 'Sage Intacct Adds AI Features',
    });

    const matched = matchArticleToCompanies(article, companies);
    expect(matched).toContain('sage');
  });
});

describe('discoverNewCompanies', () => {
  const existingCompanies: Company[] = [
    {
      id: 'intuit',
      name: 'Intuit',
      aliases: ['QuickBooks'],
      website: null,
      description: null,
      category: null,
      categorySlug: null,
      fundingStage: null,
      logoUrl: null,
      isActive: true,
      addedAt: '2026-01-01T00:00:00Z',
      articleCount: 0,
      lastMentionedAt: null,
      jobsBoardType: null,
      jobsBoardToken: null,
    },
  ];

  function makeScoredArticle(overrides: Partial<ScoredArticle> = {}): ScoredArticle {
    return {
      url: 'https://example.com/article',
      title: 'Test',
      sourceType: 'rss',
      sourceName: 'Test',
      author: null,
      publishedAt: new Date().toISOString(),
      contentSnippet: null,
      imageUrl: null,
      relevanceScore: 80,
      qualityScore: 60,
      aiSummary: '',
      headline: '',
      tags: [],
      companyMentions: [],
      ...overrides,
    };
  }

  it('should find new companies not in existing list', () => {
    const articles = [
      makeScoredArticle({ companyMentions: ['Truewind', 'Intuit'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Truewind');
  });

  it('should skip companies already tracked by alias', () => {
    const articles = [
      makeScoredArticle({ companyMentions: ['QuickBooks', 'NewCo'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NewCo');
  });

  it('should skip articles below publish score', () => {
    const articles = [
      makeScoredArticle({ relevanceScore: 30, companyMentions: ['Truewind'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(0);
  });

  it('should skip generic names', () => {
    const articles = [
      makeScoredArticle({ companyMentions: ['AI', 'the', 'Truewind'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Truewind');
  });

  it('should deduplicate across articles', () => {
    const articles = [
      makeScoredArticle({ url: 'https://a.com', companyMentions: ['Truewind'] }),
      makeScoredArticle({ url: 'https://b.com', companyMentions: ['Truewind'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(1);
  });

  it('should respect the limit parameter', () => {
    const articles = [
      makeScoredArticle({
        companyMentions: ['CompA', 'CompB', 'CompC', 'CompD'],
      }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {}, 2);
    expect(result).toHaveLength(2);
  });

  it('should attach website hints', () => {
    const articles = [
      makeScoredArticle({ companyMentions: ['Truewind'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {
      Truewind: 'truewind.ai',
    });
    expect(result[0].website).toBe('truewind.ai');
  });

  it('should be case-insensitive when matching existing companies', () => {
    const articles = [
      makeScoredArticle({ companyMentions: ['intuit', 'INTUIT', 'NewCo'] }),
    ];
    const result = discoverNewCompanies(articles, existingCompanies, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NewCo');
  });
});
