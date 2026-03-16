import { describe, it, expect, vi, beforeEach } from 'vitest';
import { arxivCollector } from './arxiv';
import type { SourceConfig } from '../types';

// Sample arXiv Atom feed XML for testing
const SAMPLE_ARXIV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <link href="http://arxiv.org/api/query?search_query=cat:cs.AI" rel="self" type="application/atom+xml"/>
  <title type="html">ArXiv Query: cat:cs.AI</title>
  <id>http://arxiv.org/api/query?search_query=cat:cs.AI</id>
  <updated>2025-03-10T00:00:00-04:00</updated>
  <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">100</opensearch:totalResults>
  <opensearch:startIndex xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">0</opensearch:startIndex>
  <opensearch:itemsPerPage xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">50</opensearch:itemsPerPage>
  <entry>
    <id>http://arxiv.org/abs/2503.01234v1</id>
    <updated>2025-03-10T12:00:00Z</updated>
    <published>2025-03-10T12:00:00Z</published>
    <title>AI-Driven Audit Automation: A Framework for Agentic Systems in Accounting</title>
    <summary>This paper presents a novel framework for leveraging agentic AI systems in accounting audit workflows. We demonstrate that autonomous AI agents can significantly reduce manual effort in financial statement analysis while maintaining accuracy standards required by regulatory bodies.</summary>
    <author>
      <name>Alice Smith</name>
    </author>
    <author>
      <name>Bob Jones</name>
    </author>
    <author>
      <name>Charlie Brown</name>
    </author>
    <link href="http://arxiv.org/abs/2503.01234v1" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2503.01234v1" rel="related" type="application/pdf"/>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2503.05678v2</id>
    <updated>2025-03-09T18:30:00Z</updated>
    <published>2025-03-08T10:00:00Z</published>
    <title>Machine Learning for Tax Compliance: Detecting Anomalies in Corporate Returns</title>
    <summary>We propose a machine learning approach for automated tax compliance verification. Our system achieves 95% accuracy in detecting anomalous entries in corporate tax returns, significantly outperforming rule-based systems currently used by major accounting firms.</summary>
    <author>
      <name>Diana Prince</name>
    </author>
    <link href="http://arxiv.org/abs/2503.05678v2" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2503.05678v2" rel="related" type="application/pdf"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

// Minimal XML with a single entry, no link element (should fall back to <id>)
const SAMPLE_NO_LINK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test</title>
  <entry>
    <id>http://arxiv.org/abs/2503.99999v1</id>
    <published>2025-03-01T00:00:00Z</published>
    <title>Fallback ID Test</title>
    <summary>Test abstract content.</summary>
    <author>
      <name>Test Author</name>
    </author>
  </entry>
</feed>`;

// XML with an entry missing a title (should be skipped)
const SAMPLE_NO_TITLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test</title>
  <entry>
    <id>http://arxiv.org/abs/2503.11111v1</id>
    <published>2025-03-01T00:00:00Z</published>
    <summary>An entry with no title.</summary>
    <author>
      <name>No Title Author</name>
    </author>
  </entry>
</feed>`;

// XML with long abstract that should be truncated
const LONG_ABSTRACT = 'A'.repeat(600);
const SAMPLE_LONG_ABSTRACT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test</title>
  <entry>
    <id>http://arxiv.org/abs/2503.22222v1</id>
    <published>2025-03-05T00:00:00Z</published>
    <title>Long Abstract Paper</title>
    <summary>${LONG_ABSTRACT}</summary>
    <author>
      <name>Verbose Author</name>
    </author>
    <link href="http://arxiv.org/abs/2503.22222v1" rel="alternate" type="text/html"/>
  </entry>
</feed>`;

// Empty feed (no entries)
const SAMPLE_EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty Feed</title>
</feed>`;

function makeConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    id: 'arxiv-test',
    sourceType: 'arxiv',
    name: 'arXiv CS.AI',
    config: {
      query: 'cat:cs.AI AND (all:accounting OR all:audit)',
    },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
    ...overrides,
  };
}

describe('arxivCollector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a valid arXiv Atom feed with multiple entries', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_ARXIV_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(2);

    // First article
    expect(articles[0].title).toBe(
      'AI-Driven Audit Automation: A Framework for Agentic Systems in Accounting'
    );
    expect(articles[0].url).toBe('https://arxiv.org/abs/2503.01234v1');
    expect(articles[0].sourceType).toBe('arxiv');
    expect(articles[0].sourceName).toBe('arXiv CS.AI');
    expect(articles[0].author).toBe('Alice Smith, Bob Jones & 1 other');
    expect(articles[0].publishedAt).toBe('2025-03-10T12:00:00Z');
    expect(articles[0].contentSnippet).toContain('novel framework');
    expect(articles[0].imageUrl).toBeNull();

    // Second article — single author
    expect(articles[1].title).toBe(
      'Machine Learning for Tax Compliance: Detecting Anomalies in Corporate Returns'
    );
    expect(articles[1].author).toBe('Diana Prince');
    expect(articles[1].publishedAt).toBe('2025-03-08T10:00:00Z');
  });

  it('normalizes http arxiv URLs to https', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_ARXIV_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    for (const article of articles) {
      expect(article.url).toMatch(/^https:\/\/arxiv\.org/);
    }
  });

  it('falls back to <id> when no link element exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_NO_LINK_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://arxiv.org/abs/2503.99999v1');
    expect(articles[0].title).toBe('Fallback ID Test');
  });

  it('skips entries without a title', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_NO_TITLE_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(0);
  });

  it('truncates long abstracts to 500 characters', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_LONG_ABSTRACT_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(1);
    expect(articles[0].contentSnippet).not.toBeNull();
    expect(articles[0].contentSnippet!.length).toBeLessThanOrEqual(500);
    expect(articles[0].contentSnippet!).toMatch(/\.\.\.$/);
  });

  it('returns empty array for empty feed', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_EMPTY_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(0);
  });

  it('returns empty array when source is inactive', async () => {
    const articles = await arxivCollector.collect(
      makeConfig({ isActive: false })
    );

    expect(articles).toHaveLength(0);
  });

  it('returns empty array when no query is configured', async () => {
    const articles = await arxivCollector.collect(
      makeConfig({ config: {} })
    );

    expect(articles).toHaveLength(0);
  });

  it('returns empty array on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(0);
  });

  it('returns empty array on fetch exception', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());

    expect(articles).toHaveLength(0);
  });

  it('builds correct query URL with config parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_EMPTY_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    await arxivCollector.collect(makeConfig());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('export.arxiv.org/api/query');
    expect(calledUrl).toContain('search_query=');
    expect(calledUrl).toContain('sortBy=submittedDate');
    expect(calledUrl).toContain('sortOrder=descending');
  });

  it('formats authors correctly', async () => {
    // Test with 2 authors
    const twoAuthorsXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test</title>
  <entry>
    <id>http://arxiv.org/abs/2503.33333v1</id>
    <published>2025-03-01T00:00:00Z</published>
    <title>Two Authors Paper</title>
    <summary>Test.</summary>
    <author><name>First Author</name></author>
    <author><name>Second Author</name></author>
    <link href="http://arxiv.org/abs/2503.33333v1" rel="alternate" type="text/html"/>
  </entry>
</feed>`;

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(twoAuthorsXml, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());
    expect(articles[0].author).toBe('First Author & Second Author');
  });

  it('handles entries with no authors gracefully', async () => {
    const noAuthorXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test</title>
  <entry>
    <id>http://arxiv.org/abs/2503.44444v1</id>
    <published>2025-03-01T00:00:00Z</published>
    <title>No Author Paper</title>
    <summary>Test.</summary>
    <link href="http://arxiv.org/abs/2503.44444v1" rel="alternate" type="text/html"/>
  </entry>
</feed>`;

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(noAuthorXml, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const articles = await arxivCollector.collect(makeConfig());
    expect(articles[0].author).toBe('Unknown');
  });

  it('sends correct User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(SAMPLE_EMPTY_XML, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    await arxivCollector.collect(makeConfig());

    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('AgenticAIAccounting');
  });
});
