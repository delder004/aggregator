import { describe, it, expect } from 'vitest';
import { cleanMalformedTitle, escapeHtml } from './html';

describe('cleanMalformedTitle', () => {
  it('should remove "ARTICLE N-MINUTE READ" prefix', () => {
    const malformed = 'ARTICLE 5 MINUTE READHow to Catch the AI Wave: A Guide for Accounting Firms';
    const cleaned = cleanMalformedTitle(malformed);
    expect(cleaned).toContain('How to Catch');
    expect(cleaned).not.toContain('ARTICLE');
    expect(cleaned).not.toContain('MINUTE READ');
  });

  it('should remove "N-minute read" prefix', () => {
    const malformed = '4-minute read An Introduction to Agentic Financial OperationsJWJon Wolf, CPA';
    const cleaned = cleanMalformedTitle(malformed);
    expect(cleaned).toContain('Introduction to Agentic');
    expect(cleaned).not.toContain('minute read');
    expect(cleaned).not.toContain('Jon Wolf');
  });

  it('should remove "N-min read" prefix', () => {
    const malformed = '3-min read How AI Transforms AccountingEBEdut Birger';
    const cleaned = cleanMalformedTitle(malformed);
    expect(cleaned).toContain('How AI Transforms');
    expect(cleaned).not.toContain('min read');
  });

  it('should remove prefix and trailing author metadata', () => {
    const malformed = 'ARTICLE 10 MINUTE READHow to Catch the AI WaveKatie Minion, CPA';
    const cleaned = cleanMalformedTitle(malformed);
    expect(cleaned).toContain('How to Catch');
    expect(cleaned).not.toContain('Katie Minion');
  });

  it('should handle well-formed titles without modification', () => {
    const wellFormed = 'How AI is Transforming Accounting Firms';
    const cleaned = cleanMalformedTitle(wellFormed);
    expect(cleaned).toBe(wellFormed);
  });

  it('should clean title with author initials concatenated', () => {
    const malformed = 'New AI Features in AccountingPJPaul Johnson, Marketing';
    const cleaned = cleanMalformedTitle(malformed);
    expect(cleaned).toContain('New AI Features');
    expect(cleaned).not.toContain('PJPaul');
  });

  it('should preserve well-formed titles with apostrophes', () => {
    const title = 'Not Your Average AI: Why Accountants Should Care';
    const cleaned = cleanMalformedTitle(title);
    expect(cleaned).toBe(title);
  });
});

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    const unsafe = '<script>alert("xss")</script>';
    const safe = escapeHtml(unsafe);
    expect(safe).not.toContain('<');
    expect(safe).not.toContain('>');
    expect(safe).not.toContain('"');
    expect(safe).toContain('&lt;');
    expect(safe).toContain('&gt;');
    expect(safe).toContain('&quot;');
  });

  it('should preserve content while escaping', () => {
    const input = 'Tom & Jerry';
    const output = escapeHtml(input);
    expect(output).toBe('Tom &amp; Jerry');
  });
});
