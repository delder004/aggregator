import { describe, expect, it } from 'vitest';
import {
  extractRootDomain,
  isDenied,
  matchesTheme,
  validateQuery,
} from './theme';

describe('matchesTheme', () => {
  it('accepts text with both AI and finance terms', () => {
    expect(matchesTheme('AI agent for audit teams')).toBe(true);
    expect(matchesTheme('LLM-powered bookkeeping')).toBe(true);
    expect(matchesTheme('How autonomous agents handle reconciliation')).toBe(true);
    expect(matchesTheme('Copilot for CPAs')).toBe(true);
  });

  it('rejects text with only AI terms', () => {
    expect(matchesTheme('best AI tools of 2026')).toBe(false);
    expect(matchesTheme('autonomous agent benchmarks')).toBe(false);
  });

  it('rejects text with only finance terms', () => {
    expect(matchesTheme('audit best practices')).toBe(false);
    expect(matchesTheme('CFO compensation trends')).toBe(false);
  });

  it('rejects empty / null / undefined', () => {
    expect(matchesTheme('')).toBe(false);
    expect(matchesTheme(null)).toBe(false);
    expect(matchesTheme(undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchesTheme('AGENTIC AI FOR ACCOUNTING')).toBe(true);
    expect(matchesTheme('LLM CFO Copilot')).toBe(true);
  });
});

describe('validateQuery', () => {
  it('mirrors matchesTheme for query strings', () => {
    expect(validateQuery('AI audit automation')).toBe(true);
    expect(validateQuery('best AI tools 2026')).toBe(false);
    expect(validateQuery('audit best practices')).toBe(false);
  });
});

describe('extractRootDomain', () => {
  it('strips www and protocol', () => {
    expect(extractRootDomain('https://www.example.com/page')).toBe('example.com');
    expect(extractRootDomain('http://example.com')).toBe('example.com');
    expect(extractRootDomain('example.com')).toBe('example.com');
  });

  it('collapses arbitrary subdomains', () => {
    expect(extractRootDomain('https://blog.example.com')).toBe('example.com');
    expect(extractRootDomain('https://a.b.c.example.com')).toBe('example.com');
  });

  it('handles two-part TLDs', () => {
    expect(extractRootDomain('https://blog.example.co.uk')).toBe('example.co.uk');
    expect(extractRootDomain('https://example.com.au')).toBe('example.com.au');
  });

  it('returns null on malformed input', () => {
    expect(extractRootDomain('not a url')).toBe(null);
  });
});

describe('isDenied', () => {
  it('blocks mainstream news sites by root domain', () => {
    expect(isDenied('https://www.nytimes.com/2026/05/01/article')).toBe(true);
    expect(isDenied('https://techcrunch.com/feed')).toBe(true);
    expect(isDenied('https://bbc.co.uk/news')).toBe(true);
  });

  it('blocks subdomains of denied roots', () => {
    expect(isDenied('https://blog.medium.com/post')).toBe(true);
    expect(isDenied('https://someauthor.substack.com')).toBe(true);
  });

  it('blocks Big 4 / consulting firms', () => {
    expect(isDenied('https://www2.deloitte.com/insights/feed.rss.xml')).toBe(true);
    expect(isDenied('https://ey.com/en_us/insights/audit-ai')).toBe(true);
    expect(isDenied('https://kpmg.com/us/en/blogs')).toBe(true);
    expect(isDenied('https://www.pwc.com/us/en/services/audit')).toBe(true);
  });

  it('blocks analyst / research publishers', () => {
    expect(isDenied('https://www.thomsonreuters.com/en/tax-blog')).toBe(true);
    expect(isDenied('https://www.wolterskluwer.com/expert-insights')).toBe(true);
    expect(isDenied('https://www.gartner.com/en/research')).toBe(true);
  });

  it('allows unfamiliar domains', () => {
    expect(isDenied('https://acme-ai-audit.com')).toBe(false);
    expect(isDenied('https://blog.smallcpafirm.com')).toBe(false);
  });
});
