import { describe, it, expect } from 'vitest';
import {
  buildUserMessage,
  parseAndValidateResponse,
  ALLOWED_TAGS,
  MIN_PUBLISH_SCORE,
} from './classifier';
import type { CollectedArticle } from '../types';
import type { SocialSignals } from './classifier';

function makeArticle(overrides: Partial<CollectedArticle> = {}): CollectedArticle {
  return {
    url: 'https://example.com/article',
    title: 'AI Agents Transform Accounting',
    sourceType: 'rss',
    sourceName: 'Accounting Today',
    author: null,
    publishedAt: '2025-03-15T12:00:00.000Z',
    contentSnippet: null,
    imageUrl: null,
    ...overrides,
  };
}

describe('parseAndValidateResponse', () => {
  it('should parse a valid response with all fields', () => {
    const json = JSON.stringify({
      relevanceScore: 85,
      qualityScore: 72,
      tags: ['agentic-ai', 'automation', 'big-4'],
      summary: 'Deloitte launches new AI agent platform for audit workflows.',
      companyMentions: ['Deloitte', 'OpenAI'],
    });

    const result = parseAndValidateResponse(json);
    expect(result.relevanceScore).toBe(85);
    expect(result.qualityScore).toBe(72);
    expect(result.tags).toEqual(['agentic-ai', 'automation', 'big-4']);
    expect(result.summary).toBe('Deloitte launches new AI agent platform for audit workflows.');
    expect(result.companyMentions).toEqual(['Deloitte', 'OpenAI']);
  });

  it('should clamp relevanceScore to 0-100', () => {
    const overHundred = JSON.stringify({
      relevanceScore: 150,
      qualityScore: 50,
      tags: [],
      summary: 'Test summary.',
      companyMentions: [],
    });
    expect(parseAndValidateResponse(overHundred).relevanceScore).toBe(100);

    const negative = JSON.stringify({
      relevanceScore: -10,
      qualityScore: 50,
      tags: [],
      summary: 'Test summary.',
      companyMentions: [],
    });
    expect(parseAndValidateResponse(negative).relevanceScore).toBe(0);
  });

  it('should clamp qualityScore to 0-100', () => {
    const overHundred = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 200,
      tags: [],
      summary: 'Test summary.',
      companyMentions: [],
    });
    expect(parseAndValidateResponse(overHundred).qualityScore).toBe(100);

    const negative = JSON.stringify({
      relevanceScore: 50,
      qualityScore: -5,
      tags: [],
      summary: 'Test summary.',
      companyMentions: [],
    });
    expect(parseAndValidateResponse(negative).qualityScore).toBe(0);
  });

  it('should round fractional scores', () => {
    const json = JSON.stringify({
      relevanceScore: 75.7,
      qualityScore: 62.3,
      tags: [],
      summary: 'Test summary.',
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.relevanceScore).toBe(76);
    expect(result.qualityScore).toBe(62);
  });

  it('should throw when relevanceScore is missing', () => {
    const json = JSON.stringify({
      qualityScore: 50,
      tags: [],
      summary: 'Test.',
      companyMentions: [],
    });
    expect(() => parseAndValidateResponse(json)).toThrow('relevanceScore is not a number');
  });

  it('should throw when qualityScore is missing', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      tags: [],
      summary: 'Test.',
      companyMentions: [],
    });
    expect(() => parseAndValidateResponse(json)).toThrow('qualityScore is not a number');
  });

  it('should filter out unknown tags', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: ['agentic-ai', 'invalid-tag', 'tax', 'unknown', 'product-launch'],
      summary: 'Test summary.',
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.tags).toEqual(['agentic-ai', 'tax', 'product-launch']);
  });

  it('should accept new tags: product-launch, funding, partnership, integration, open-source', () => {
    const newTags = ['product-launch', 'funding', 'partnership', 'integration', 'open-source'];
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: newTags,
      summary: 'Test summary.',
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.tags).toEqual(newTags);
  });

  it('should limit tags to 5', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: ['audit', 'tax', 'bookkeeping', 'compliance', 'payroll', 'invoicing', 'automation'],
      summary: 'Test summary.',
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.tags).toHaveLength(5);
  });

  it('should truncate summary to 280 characters', () => {
    const longSummary = 'A'.repeat(300);
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: longSummary,
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.summary.length).toBe(280);
    expect(result.summary.endsWith('...')).toBe(true);
  });

  it('should throw when summary is empty', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: '',
      companyMentions: [],
    });
    expect(() => parseAndValidateResponse(json)).toThrow('summary is empty or not a string');
  });

  it('should handle companyMentions as empty array', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: 'Test.',
      companyMentions: [],
    });
    const result = parseAndValidateResponse(json);
    expect(result.companyMentions).toEqual([]);
  });

  it('should handle missing companyMentions gracefully (default to empty array)', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: 'Test.',
    });
    const result = parseAndValidateResponse(json);
    expect(result.companyMentions).toEqual([]);
  });

  it('should filter out non-string values from companyMentions', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: 'Test.',
      companyMentions: ['Deloitte', 42, null, '', 'Intuit'],
    });
    const result = parseAndValidateResponse(json);
    expect(result.companyMentions).toEqual(['Deloitte', 'Intuit']);
  });

  it('should trim whitespace from company names', () => {
    const json = JSON.stringify({
      relevanceScore: 50,
      qualityScore: 50,
      tags: [],
      summary: 'Test.',
      companyMentions: ['  Deloitte  ', 'Intuit'],
    });
    const result = parseAndValidateResponse(json);
    expect(result.companyMentions).toEqual(['Deloitte', 'Intuit']);
  });

  it('should strip markdown code fences from response', () => {
    const json = '```json\n{"relevanceScore":80,"qualityScore":60,"tags":["tax"],"summary":"Test.","companyMentions":[]}\n```';
    const result = parseAndValidateResponse(json);
    expect(result.relevanceScore).toBe(80);
    expect(result.qualityScore).toBe(60);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseAndValidateResponse('not json at all')).toThrow('Failed to parse classifier JSON');
  });

  it('should throw on non-object JSON', () => {
    expect(() => parseAndValidateResponse('"just a string"')).toThrow('Classifier response is not an object');
  });
});

describe('buildUserMessage', () => {
  it('should include title and source with source type', () => {
    const article = makeArticle();
    const message = buildUserMessage(article);
    expect(message).toContain('Title: AI Agents Transform Accounting');
    expect(message).toContain('Source: Accounting Today (rss)');
  });

  it('should include author when available', () => {
    const article = makeArticle({ author: 'John Smith' });
    const message = buildUserMessage(article);
    expect(message).toContain('Author: John Smith');
  });

  it('should not include author line when author is null', () => {
    const article = makeArticle({ author: null });
    const message = buildUserMessage(article);
    expect(message).not.toContain('Author:');
  });

  it('should include content snippet when available', () => {
    const article = makeArticle({
      contentSnippet: 'This article discusses how AI agents are revolutionizing accounting workflows.',
    });
    const message = buildUserMessage(article);
    expect(message).toContain(
      'Content: This article discusses how AI agents are revolutionizing accounting workflows.'
    );
  });

  it('should not include content line when snippet is null', () => {
    const article = makeArticle({ contentSnippet: null });
    const message = buildUserMessage(article);
    expect(message).not.toContain('Content:');
  });

  it('should include social signals when upvotes are provided', () => {
    const article = makeArticle();
    const signals: SocialSignals = { upvotes: 150 };
    const message = buildUserMessage(article, signals);
    expect(message).toContain('Social: 150 upvotes');
  });

  it('should include social signals when comments are provided', () => {
    const article = makeArticle();
    const signals: SocialSignals = { comments: 42 };
    const message = buildUserMessage(article, signals);
    expect(message).toContain('Social: 42 comments');
  });

  it('should include both upvotes and comments when both provided', () => {
    const article = makeArticle();
    const signals: SocialSignals = { upvotes: 200, comments: 50 };
    const message = buildUserMessage(article, signals);
    expect(message).toContain('Social: 200 upvotes, 50 comments');
  });

  it('should not include social line when signals are undefined', () => {
    const article = makeArticle();
    const message = buildUserMessage(article);
    expect(message).not.toContain('Social:');
  });

  it('should not include social line when signals object is empty', () => {
    const article = makeArticle();
    const signals: SocialSignals = {};
    const message = buildUserMessage(article, signals);
    expect(message).not.toContain('Social:');
  });

  it('should include published date', () => {
    const article = makeArticle({ publishedAt: '2025-03-15T12:00:00.000Z' });
    const message = buildUserMessage(article);
    expect(message).toContain('Published: 2025-03-15T12:00:00.000Z');
  });

  it('should include source type in parentheses', () => {
    const article = makeArticle({ sourceType: 'hn', sourceName: 'Hacker News' });
    const message = buildUserMessage(article);
    expect(message).toContain('Source: Hacker News (hn)');
  });

  it('should produce correctly ordered output with all fields', () => {
    const article = makeArticle({
      author: 'Jane Doe',
      contentSnippet: 'Full article content here.',
      publishedAt: '2025-03-15T10:00:00.000Z',
    });
    const signals: SocialSignals = { upvotes: 100, comments: 25 };
    const message = buildUserMessage(article, signals);

    const lines = message.split('\n');
    expect(lines[0]).toBe('Title: AI Agents Transform Accounting');
    expect(lines[1]).toBe('Source: Accounting Today (rss)');
    expect(lines[2]).toBe('Author: Jane Doe');
    expect(lines[3]).toBe('Content: Full article content here.');
    expect(lines[4]).toBe('Social: 100 upvotes, 25 comments');
    expect(lines[5]).toBe('Published: 2025-03-15T10:00:00.000Z');
  });
});

describe('ALLOWED_TAGS', () => {
  it('should contain all original tags', () => {
    const originalTags = [
      'audit', 'tax', 'bookkeeping', 'compliance', 'payroll',
      'invoicing', 'fraud-detection', 'financial-reporting',
      'agentic-ai', 'llm', 'automation', 'startup', 'big-4',
      'regulation', 'case-study', 'opinion', 'research',
    ];
    for (const tag of originalTags) {
      expect(ALLOWED_TAGS.has(tag)).toBe(true);
    }
  });

  it('should contain all new tags', () => {
    const newTags = ['product-launch', 'funding', 'partnership', 'integration', 'open-source'];
    for (const tag of newTags) {
      expect(ALLOWED_TAGS.has(tag)).toBe(true);
    }
  });

  it('should have exactly 22 tags total', () => {
    expect(ALLOWED_TAGS.size).toBe(22);
  });
});

describe('MIN_PUBLISH_SCORE', () => {
  it('should be 50', () => {
    expect(MIN_PUBLISH_SCORE).toBe(50);
  });
});

