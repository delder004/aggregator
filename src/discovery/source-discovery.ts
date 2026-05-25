/**
 * Source discovery orchestrator.
 *
 * Weekly pipeline:
 *   1. Load known source domains (so we don't re-suggest them).
 *   2. Build synthesis context (GSC + page-2 rankings + competitors).
 *   3. Synthesize ~25 theme-locked queries via Haiku.
 *   4. SERP sweep — Serper for each query, filter by theme/deny/known.
 *   5. Keep domains seen in ≥ MIN_QUERY_COUNT distinct queries.
 *   6. Theme-classify each survivor (Haiku, from SERP sample title+snippet).
 *   7. Probe blog (RSS feed or scrape-able blog URL) for theme=yes survivors.
 *   8. Upsert each survivor into source_candidates with origin='web_search'.
 *
 * The contributor agent then reads source_candidates where status='new'
 * during its daily run and approves or rejects each.
 */

import type { Env } from '../types';
import { upsertSourceCandidate } from '../analytics/db';
import { getAllActiveSources } from '../db/queries';
import { discoverBlog } from '../company/enricher';
import { extractRootDomain } from './theme';
import {
  loadSynthesisContext,
  synthesizeKeywords,
  type SynthesisContext,
} from './keyword-synthesis';
import { sweepQueries, type DomainHit, type SerpSweepResult } from './serp-sweep';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';

export const MIN_QUERY_COUNT = 3;
export const MAX_CANDIDATES_PER_RUN = 25;

export interface SourceDiscoveryOptions {
  /** Override the synthesized query list. For local debugging only. */
  queries?: string[];
  /** Override the minimum distinct-query count for promotion (default 3). */
  minQueryCount?: number;
  /** Cap how many domains get probed + classified per run (default 25). */
  maxCandidates?: number;
}

export interface SourceDiscoveryResult {
  queriesSynthesized: number;
  serpStats: SerpSweepResult;
  candidatesAboveThreshold: number;
  candidatesClassified: number;
  candidatesPromoted: number;
  classificationRejected: number;
  errors: string[];
}

export async function runSourceDiscovery(
  env: Env,
  options: SourceDiscoveryOptions = {}
): Promise<SourceDiscoveryResult> {
  const minQueryCount = options.minQueryCount ?? MIN_QUERY_COUNT;
  const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES_PER_RUN;
  const errors: string[] = [];

  const knownDomains = await loadKnownDomains(env);

  let queries: string[];
  let queriesSynthesized = 0;
  if (options.queries && options.queries.length > 0) {
    queries = options.queries;
    queriesSynthesized = queries.length;
  } else {
    const context = await loadSynthesisContext(env);
    queries = await safeSynthesize(env, context, errors);
    queriesSynthesized = queries.length;
  }

  if (queries.length === 0) {
    return {
      queriesSynthesized: 0,
      serpStats: emptySerpStats(),
      candidatesAboveThreshold: 0,
      candidatesClassified: 0,
      candidatesPromoted: 0,
      classificationRejected: 0,
      errors: errors.length > 0 ? errors : ['No queries synthesized'],
    };
  }

  const serpStats = await sweepQueries(env, queries, knownDomains);
  errors.push(...serpStats.errors);

  const aboveThreshold = serpStats.domains
    .filter((d) => d.queries.length >= minQueryCount)
    .slice(0, maxCandidates);

  let classified = 0;
  let promoted = 0;
  let rejected = 0;

  for (const hit of aboveThreshold) {
    let classification: { answer: 'yes' | 'no'; reason: string };
    try {
      classification = await classifyThemeFit(env, hit);
      classified++;
    } catch (err) {
      errors.push(
        `classify ${hit.rootDomain}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    if (classification.answer === 'no') {
      rejected++;
      continue;
    }

    let probe: { result: 'rss' | 'scraper' | 'none'; url: string | null };
    try {
      probe = await safeProbeBlog(hit.rootDomain);
    } catch (err) {
      errors.push(
        `probe ${hit.rootDomain}: ${err instanceof Error ? err.message : String(err)}`
      );
      probe = { result: 'none', url: null };
    }

    const sourceTypeGuess =
      probe.result === 'rss'
        ? 'rss'
        : probe.result === 'scraper'
          ? 'blogscraper'
          : null;

    const rationale = buildRationale(hit, classification);

    try {
      await upsertSourceCandidate(env.DB, {
        name: hit.rootDomain,
        url: `https://${hit.rootDomain}`,
        sourceTypeGuess,
        rationale,
        origin: 'web_search',
        queriesSeen: hit.queries,
        domainQueryCount: hit.queries.length,
        blogProbeResult: probe.result,
        blogProbeUrl: probe.url,
        themeClassification: classification.answer,
        themeClassificationReason: classification.reason,
        sampleTitle: hit.sampleTitle,
        sampleSnippet: hit.sampleSnippet,
      });
      promoted++;
    } catch (err) {
      errors.push(
        `upsert ${hit.rootDomain}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    queriesSynthesized,
    serpStats,
    candidatesAboveThreshold: aboveThreshold.length,
    candidatesClassified: classified,
    candidatesPromoted: promoted,
    classificationRejected: rejected,
    errors,
  };
}

async function loadKnownDomains(env: Env): Promise<Set<string>> {
  const sources = await getAllActiveSources(env.DB);
  const set = new Set<string>();
  for (const src of sources) {
    const candidates = [src.config.url, src.config.website, src.config.feedUrl];
    for (const c of candidates) {
      if (typeof c !== 'string') continue;
      const root = extractRootDomain(c);
      if (root) set.add(root);
    }
  }
  return set;
}

async function safeSynthesize(
  env: Env,
  context: SynthesisContext,
  errors: string[]
): Promise<string[]> {
  try {
    return await synthesizeKeywords(env, context);
  } catch (err) {
    errors.push(
      `synthesis: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}

async function safeProbeBlog(
  rootDomain: string
): Promise<{ result: 'rss' | 'scraper' | 'none'; url: string | null }> {
  const homepage = `https://${rootDomain}`;
  const blog = await discoverBlog(homepage);
  if (blog.type === 'rss' && blog.feedUrl) {
    return { result: 'rss', url: blog.feedUrl };
  }
  if (blog.type === 'scraper' && blog.blogUrl) {
    return { result: 'scraper', url: blog.blogUrl };
  }
  return { result: 'none', url: null };
}

const CLASSIFIER_SYSTEM = `You decide whether a domain is a good source for a niche news aggregator focused on AGENTIC AI IN ACCOUNTING (audit, tax, bookkeeping, finance ops).

Given a domain plus one example page (title + snippet from a search result), answer:
- "yes" if the site primarily covers agentic AI / LLM / automation topics specifically applied to accounting, audit, tax, bookkeeping, or finance operations
- "no" otherwise (generic AI sites, generic accounting sites, off-topic news, vendor sites that aren't AI-focused, etc.)

Output ONLY valid JSON: {"answer":"yes"|"no","reason":"<one short sentence>"} — no prose, no markdown fences.`;

interface ClassificationResponse {
  answer: 'yes' | 'no';
  reason: string;
}

export async function classifyThemeFit(
  env: Env,
  hit: DomainHit
): Promise<ClassificationResponse> {
  if (!env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY required for theme classification');
  }

  const userMessage = [
    `Domain: ${hit.rootDomain}`,
    `Example page URL: ${hit.sampleUrl}`,
    `Title: ${hit.sampleTitle}`,
    `Snippet: ${hit.sampleSnippet}`,
    `Surfaced by these queries: ${hit.queries.join('; ')}`,
    '',
    'Is this site a good source for agentic AI in accounting? JSON only.',
  ].join('\n');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      max_tokens: 256,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Classifier API ${response.status}: ${text.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    throw new Error('Classifier returned no text content');
  }

  const match = textBlock.text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Classifier output had no JSON object');
  }
  const parsed = JSON.parse(match[0]) as Partial<ClassificationResponse>;
  if (parsed.answer !== 'yes' && parsed.answer !== 'no') {
    throw new Error(`Classifier returned invalid answer: ${parsed.answer}`);
  }
  return {
    answer: parsed.answer,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

function buildRationale(
  hit: DomainHit,
  classification: ClassificationResponse
): string {
  const qs = hit.queries.slice(0, 3).join('; ');
  const more = hit.queries.length > 3 ? ` (+${hit.queries.length - 3} more)` : '';
  return `Surfaced by ${hit.queries.length} discovery queries [${qs}${more}]. Theme classifier: ${classification.reason}`;
}

function emptySerpStats(): SerpSweepResult {
  return {
    totalQueries: 0,
    totalResults: 0,
    filteredOffTheme: 0,
    filteredDenied: 0,
    filteredKnown: 0,
    domains: [],
    errors: [],
  };
}
