// Smoke tests for the Phase 4A dual-narrative taxonomy.
//
// Bucket A ("Accountant work disappearing") is defined; bucket B
// ("New accounting roles emerging") is deferred to Phase 4A.5 because the
// data layer doesn't exist yet. Tests only cover the shipped helper.

import { describe, it, expect } from 'vitest';
import {
  AUTOMATED_WORK_TAGS,
  isAutomatedWorkArticle,
} from './dual-narrative';
import type { Article } from '../types';

function article(tags: string[]): Article {
  return {
    id: 't',
    url: 't',
    title: 't',
    headline: null,
    sourceType: 'rss',
    sourceName: 't',
    author: null,
    publishedAt: '',
    fetchedAt: '',
    contentSnippet: null,
    imageUrl: null,
    relevanceScore: null,
    qualityScore: null,
    aiSummary: null,
    tags,
    isPublished: true,
    socialScore: null,
    commentCount: null,
    companyMentions: [],
    transcript: null,
    transcriptSummary: null,
  };
}

describe('dual-narrative taxonomy', () => {
  it('AUTOMATED_WORK_TAGS is non-empty', () => {
    expect(AUTOMATED_WORK_TAGS.size).toBeGreaterThan(0);
  });

  it('isAutomatedWorkArticle matches if any tag is in the bucket', () => {
    expect(isAutomatedWorkArticle(article(['audit', 'opinion']))).toBe(true);
    expect(isAutomatedWorkArticle(article(['agentic-ai', 'opinion']))).toBe(
      false,
    );
    expect(isAutomatedWorkArticle(article([]))).toBe(false);
  });

  it('does not classify meta-tech or momentum tags as automated work', () => {
    // These are deliberately in neither bucket — guards against drift.
    for (const tag of [
      'agentic-ai',
      'llm',
      'automation',
      'big-4',
      'startup',
      'funding',
      'product-launch',
      'opinion',
      'research',
    ]) {
      expect(
        isAutomatedWorkArticle(article([tag])),
        `'${tag}' must not be classified as automated work`,
      ).toBe(false);
    }
  });
});
