import { describe, it, expect } from 'vitest';
import { sanitizeTitle, decodeHtmlEntities } from './utils';

describe('decodeHtmlEntities', () => {
  it('decodes hex character references', () => {
    expect(decodeHtmlEntities('Campfire&#x27;s update')).toBe("Campfire's update");
  });

  it('decodes decimal character references', () => {
    expect(decodeHtmlEntities('foo&#38;bar')).toBe('foo&bar');
  });

  it('decodes named entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39; &apos;'))
      .toBe("& < > \" ' '");
    expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('Hello world')).toBe('Hello world');
  });
});

describe('sanitizeTitle', () => {
  it('strips leading "Article" prefix', () => {
    expect(sanitizeTitle('Article How AI Is Changing Audit'))
      .toBe('How AI Is Changing Audit');
  });

  it('strips leading date pattern like "March 01, 2026Some title"', () => {
    expect(sanitizeTitle('March 01, 2026Some title')).toBe('Some title');
  });

  it('strips trailing joined suffix ("CampfireTeam" -> "Campfire")', () => {
    expect(sanitizeTitle('CampfireTeam')).toBe('Campfire');
  });

  it('does NOT strip suffix with space before it', () => {
    expect(sanitizeTitle('AI for Your Team')).toBe('AI for Your Team');
  });

  it('does NOT strip "Blog" with space before it', () => {
    expect(sanitizeTitle('Building the Future of Admin')).toBe('Building the Future of Admin');
  });

  it('strips trailing "Staff" suffix when joined', () => {
    expect(sanitizeTitle('AccountingStaff')).toBe('Accounting');
  });

  it('decodes HTML entities', () => {
    expect(sanitizeTitle('Campfire&#x27;s update')).toBe("Campfire's update");
  });

  it('truncates long titles at sentence boundary', () => {
    const longTitle =
      'This is a moderately long sentence that is about fifty characters. And this second sentence pushes us well past one hundred and twenty total characters in length.';
    const result = sanitizeTitle(longTitle);
    expect(result).toBe('This is a moderately long sentence that is about fifty characters.');
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it('truncates long titles with hard cutoff when no sentence boundary found', () => {
    const longTitle = 'A'.repeat(150);
    const result = sanitizeTitle(longTitle);
    expect(result.length).toBe(120);
    expect(result.endsWith('...')).toBe(true);
    expect(result).toBe('A'.repeat(117) + '...');
  });

  it('handles empty string gracefully', () => {
    expect(sanitizeTitle('')).toBe('');
  });

  it('handles short strings gracefully', () => {
    expect(sanitizeTitle('Hi')).toBe('Hi');
  });

  it('leaves clean titles unchanged', () => {
    expect(sanitizeTitle('AI Transforms Modern Accounting Workflows'))
      .toBe('AI Transforms Modern Accounting Workflows');
  });

  it('collapses whitespace', () => {
    expect(sanitizeTitle('  Too   many   spaces  ')).toBe('Too many spaces');
  });

  it('handles real Campfire Blog title', () => {
    // Date stripped, entities decoded, trailing "Team" stripped (joined to "Campfire")
    // Result is under 120 chars so no truncation
    expect(sanitizeTitle("March 01, 2026Campfire&#x27;s February 2026 product updates: AI-powered accounting, FX management, CRM Integrations, and moreCampfireTeam"))
      .toBe("Campfire's February 2026 product updates: AI-powered accounting, FX management, CRM Integrations, and moreCampfire");
  });

  it('handles real Dual Entry Blog title', () => {
    // "Article" stripped (followed by uppercase). Result is 110 chars, under 120 threshold.
    // The AI-generated headline will provide a cleaner display title.
    expect(sanitizeTitle('ArticleAI Accounting Benchmark: New OpenAI GPT-5.4 Model Tops 19 AI Systems in Real Accounting Workflow TestDualEntry'))
      .toBe('AI Accounting Benchmark: New OpenAI GPT-5.4 Model Tops 19 AI Systems in Real Accounting Workflow TestDualEntry');
  });

  it('truncates titles over 120 chars with description concatenated', () => {
    // Simulates blogscraper capturing title + description in one string.
    // The ": " break point is at position 25, before the 40-char threshold,
    // so hard truncation kicks in at 117 + "..."
    const scraped = 'ArticleAI Accounting Benchmark: New OpenAI GPT-5.4 Model Tops 19 AI SystemsDiscover how the latest AI models perform on real accounting tasks';
    const result = sanitizeTitle(scraped);
    expect(result.length).toBe(120);
    expect(result.endsWith('...')).toBe(true);
  });
});
