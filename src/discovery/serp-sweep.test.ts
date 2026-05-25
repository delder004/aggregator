import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sweepQueries } from './serp-sweep';
import type { Env } from '../types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function serperResponse(
  organic: Array<{ position?: number; title?: string; link?: string; snippet?: string }>
) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ organic }),
    json: async () => ({ organic }),
  } as unknown as Response;
}

const env = { SERPER_API_KEY: 'test-key' } as Env;

describe('sweepQueries', () => {
  it('aggregates a domain across multiple queries', async () => {
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 1,
          title: 'AI bookkeeping automation tools',
          link: 'https://acme-cpa.com/blog/ai-bookkeeping',
          snippet: 'How LLM agents handle bookkeeping for SMBs',
        },
      ])
    );
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 2,
          title: 'AI agent for CPA workflows',
          link: 'https://acme-cpa.com/blog/cpa-workflows',
          snippet: 'AI agents in audit and tax',
        },
      ])
    );

    const result = await sweepQueries(
      env,
      ['AI bookkeeping automation', 'AI agent CPA workflows'],
      new Set()
    );

    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].rootDomain).toBe('acme-cpa.com');
    expect(result.domains[0].queries).toHaveLength(2);
    expect(result.totalResults).toBe(2);
  });

  it('drops off-theme results', async () => {
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 1,
          title: 'Best AI tools 2026',
          link: 'https://generic-ai-blog.com/best-tools',
          snippet: 'Top AI tools across categories',
        },
      ])
    );

    const result = await sweepQueries(env, ['AI accounting'], new Set());
    expect(result.domains).toHaveLength(0);
    expect(result.filteredOffTheme).toBe(1);
  });

  it('drops deny-listed domains even when on-theme', async () => {
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 1,
          title: 'AI is reshaping audit, finance teams',
          link: 'https://www.wsj.com/articles/ai-audit',
          snippet: 'AI audit automation across CPAs',
        },
      ])
    );

    const result = await sweepQueries(env, ['AI audit news'], new Set());
    expect(result.domains).toHaveLength(0);
    expect(result.filteredDenied).toBe(1);
  });

  it('drops domains already tracked', async () => {
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 1,
          title: 'AI bookkeeping for accounting firms',
          link: 'https://known-source.com/post',
          snippet: 'Agentic AI for CPAs',
        },
      ])
    );

    const result = await sweepQueries(
      env,
      ['AI accounting firms'],
      new Set(['known-source.com'])
    );
    expect(result.domains).toHaveLength(0);
    expect(result.filteredKnown).toBe(1);
  });

  it('records Serper errors but continues across queries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network blip'));
    fetchMock.mockResolvedValueOnce(
      serperResponse([
        {
          position: 1,
          title: 'LLM tax workflows for CPAs',
          link: 'https://recovers.com/blog/tax',
          snippet: 'AI agents in tax automation',
        },
      ])
    );

    const result = await sweepQueries(
      env,
      ['AI tax', 'LLM CPA'],
      new Set()
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('AI tax');
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].rootDomain).toBe('recovers.com');
  });
});
