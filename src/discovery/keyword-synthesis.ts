/**
 * Keyword synthesis for source discovery.
 *
 * Reads three signals — GSC top queries, page-2 rankings (positions 11–30),
 * and recent competitor item titles — and asks Haiku to synthesize ~25
 * new search queries that strictly intersect the AI + finance vocabularies.
 * Every returned query is validated against the theme vocabulary; off-theme
 * outputs are dropped before they reach Serper.
 */

import type { Env } from '../types';
import { readBlob } from '../analytics/blob-store';
import {
  listCompetitorSnapshots,
  listRecentKeywordRankings,
  listSearchConsoleSnapshots,
} from '../analytics/db';
import type { CompetitorItem } from '../competitors/fetch';
import { validateQuery } from './theme';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SYNTHESIS_MODEL = 'claude-haiku-4-5-20251001';
const MAX_QUERIES = 25;
const GSC_TOP_N = 30;
const COMPETITOR_TITLES_N = 20;
const RANKING_FETCH_LIMIT = 200;

interface GscRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

interface SearchConsoleBlob {
  topQueries?: GscRow[];
  topPages?: unknown;
}

interface CompetitorBlob {
  items?: CompetitorItem[];
}

export interface SynthesisContext {
  gscTopQueries: Array<{ query: string; impressions: number; position: number }>;
  page2Rankings: Array<{ keyword: string; rank: number }>;
  competitorTitles: string[];
}

export async function loadSynthesisContext(env: Env): Promise<SynthesisContext> {
  const [gscQueries, rankings, competitorTitles] = await Promise.all([
    loadRecentGscQueries(env),
    loadPage2Rankings(env),
    loadCompetitorTitles(env),
  ]);
  return {
    gscTopQueries: gscQueries,
    page2Rankings: rankings,
    competitorTitles,
  };
}

async function loadRecentGscQueries(
  env: Env
): Promise<SynthesisContext['gscTopQueries']> {
  try {
    const snapshots = await listSearchConsoleSnapshots(env.DB, 2);
    const latest = snapshots.find((s) => s.status === 'complete' && s.blobKey);
    if (!latest?.blobKey) return [];
    const blob = (await readBlob(env.KV, latest.blobKey)) as SearchConsoleBlob | null;
    const rows = blob?.topQueries ?? [];
    return rows
      .slice(0, GSC_TOP_N)
      .map((r) => ({
        query: r.query,
        impressions: r.impressions,
        position: r.position,
      }));
  } catch (err) {
    console.warn('keyword-synthesis: failed to load GSC queries:', err);
    return [];
  }
}

async function loadPage2Rankings(
  env: Env
): Promise<SynthesisContext['page2Rankings']> {
  try {
    const rankings = await listRecentKeywordRankings(env.DB, RANKING_FETCH_LIMIT);
    return rankings
      .filter((r) => r.rank !== null && r.rank >= 11 && r.rank <= 30)
      .map((r) => ({ keyword: r.keyword, rank: r.rank as number }))
      .slice(0, 30);
  } catch (err) {
    console.warn('keyword-synthesis: failed to load rankings:', err);
    return [];
  }
}

async function loadCompetitorTitles(env: Env): Promise<string[]> {
  try {
    const snapshots = await listCompetitorSnapshots(env.DB, 10);
    const titles: string[] = [];
    for (const snap of snapshots) {
      if (titles.length >= COMPETITOR_TITLES_N) break;
      if (snap.status !== 'complete' || !snap.blobKey) continue;
      const blob = (await readBlob(env.KV, snap.blobKey)) as CompetitorBlob | null;
      const items = blob?.items ?? [];
      for (const item of items) {
        if (titles.length >= COMPETITOR_TITLES_N) break;
        if (item.title) titles.push(item.title);
      }
    }
    return titles;
  } catch (err) {
    console.warn('keyword-synthesis: failed to load competitor titles:', err);
    return [];
  }
}

const SYSTEM_PROMPT = `You generate search queries for a niche news aggregator focused on AGENTIC AI IN ACCOUNTING (audit, tax, bookkeeping, finance ops).

Your task: from the provided signals (GSC queries, page-2 rankings, competitor topics), synthesize NEW search queries likely to surface fresh, on-topic sources we don't yet crawl.

STRICT RULES (queries that violate these are discarded):
1. Every query MUST contain at least one AI term (agentic AI, AI agent, autonomous, LLM, AI, automation, copilot) AND at least one finance term (accounting, audit, auditing, bookkeeping, tax, CPA, CFO, finance team, controller, ledger, reconciliation).
2. Each query is 3–8 words.
3. Cover varied angles: tool-focused ("AI bookkeeping automation"), role-focused ("autonomous agent for CFO"), problem-focused ("LLM reconciliation workflows"), vendor-comparison ("AI audit software vs"), niche ("agentic AI for tax prep").
4. Avoid pure brand queries (no "[brand name] review") — those rediscover known sources.
5. Output ONLY valid JSON: {"queries": ["query 1", "query 2", ...]} — no prose, no markdown fences.`;

export async function synthesizeKeywords(
  env: Env,
  context: SynthesisContext,
  maxQueries = MAX_QUERIES
): Promise<string[]> {
  if (!env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY required for keyword synthesis');
  }

  const userMessage = buildUserMessage(context, maxQueries);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SYNTHESIS_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Synthesis API ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    throw new Error('Synthesis returned no text content');
  }

  return parseAndValidateQueries(textBlock.text, maxQueries);
}

function buildUserMessage(
  context: SynthesisContext,
  maxQueries: number
): string {
  const lines: string[] = [];
  lines.push(`Synthesize up to ${maxQueries} on-theme search queries.`);
  lines.push('');

  if (context.gscTopQueries.length > 0) {
    lines.push('## Recent Search Console queries (real demand)');
    for (const q of context.gscTopQueries) {
      lines.push(
        `- "${q.query}" (impressions=${q.impressions}, position=${q.position.toFixed(1)})`
      );
    }
    lines.push('');
  }

  if (context.page2Rankings.length > 0) {
    lines.push('## Queries where we rank page 2 (positions 11–30)');
    for (const r of context.page2Rankings) {
      lines.push(`- "${r.keyword}" (rank ${r.rank})`);
    }
    lines.push('');
  }

  if (context.competitorTitles.length > 0) {
    lines.push('## Recent competitor article titles (for topic inspiration)');
    for (const t of context.competitorTitles) {
      lines.push(`- ${t}`);
    }
    lines.push('');
  }

  lines.push(
    'Return JSON: {"queries": [...]}. Every query must contain AT LEAST ONE AI term AND AT LEAST ONE finance term, per the rules in your system prompt.'
  );

  return lines.join('\n');
}

export function parseAndValidateQueries(
  rawText: string,
  maxQueries: number
): string[] {
  const jsonBlock = extractJsonBlock(rawText);
  if (!jsonBlock) {
    throw new Error('Synthesis output had no JSON block');
  }
  let parsed: { queries?: unknown };
  try {
    parsed = JSON.parse(jsonBlock);
  } catch (err) {
    throw new Error(
      `Synthesis JSON parse failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const raw = parsed.queries;
  if (!Array.isArray(raw)) {
    throw new Error('Synthesis output missing queries array');
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const q = item.trim();
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    if (!validateQuery(q)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= maxQueries) break;
  }
  return out;
}

function extractJsonBlock(text: string): string | null {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
