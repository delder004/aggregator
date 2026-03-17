/**
 * AI-powered company insight generator.
 * Calls Claude Haiku to produce per-company briefings describing what the
 * company does and highlighting recent news/trends from collected articles.
 */

import type { Env, Article, Company, CompanyInsight } from '../types';
import { markdownToHtml } from './markdown';
import { getTrackedCompanies } from '../company/tracker';
import {
  getAllCompanyArticles,
  getAllCompanyInsights,
  insertCompanyInsight,
} from '../db/queries';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/** Regenerate insights at most once per 24 hours per company. */
const REGEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Max companies to generate insights for per run (budget control). */
const MAX_PER_RUN = 10;

const SYSTEM_PROMPT = `You are writing a company profile and news brief for a site tracking AI startups in accounting.

Given a company's metadata (name, description, category, website) and recent articles mentioning it, write a concise Markdown briefing. Structure it as follows:

## About {Company}
1-3 sentences describing what the company does, its products, target market, and approach. Use the company metadata and article context to write a helpful overview. If no articles are available, base this solely on the metadata.

## Recent News & Trends
3-5 bullet points highlighting specific recent developments, product launches, partnerships, funding, or industry mentions. Reference actual article titles when possible. If no articles are available, omit this section entirely.

Rules:
- Keep the entire response under 1500 characters.
- Do NOT include a top-level title — it will be added automatically.
- Use Markdown: ## headings, - bullets, **bold** for emphasis, *italic* for article titles.
- Be factual and specific. Do not speculate or invent information.
- Write for accounting professionals evaluating AI tools.`;

/**
 * Generate company insights for companies that need them.
 * Skips companies with a recent insight (within REGEN_COOLDOWN_MS).
 * Prioritizes companies with articles over those without.
 */
export async function generateCompanyInsights(
  env: Env,
): Promise<CompanyInsight[]> {
  const companies = await getTrackedCompanies(env.DB);
  if (companies.length === 0) return [];

  const companyArticles = await getAllCompanyArticles(env.DB);

  let existingInsights: Map<string, CompanyInsight>;
  try {
    existingInsights = await getAllCompanyInsights(env.DB);
  } catch {
    // Table might not exist yet on first run
    existingInsights = new Map();
  }

  const now = Date.now();

  // Filter to companies needing a new insight
  const needsInsight = companies.filter((c) => {
    const existing = existingInsights.get(c.id);
    if (!existing) return true;
    const age = now - new Date(existing.generatedAt).getTime();
    // Regenerate if older than cooldown AND article count has changed
    const articles = companyArticles.get(c.id) ?? [];
    return age > REGEN_COOLDOWN_MS && articles.length !== existing.articleCount;
  });

  // Prioritize: companies with articles first, then by article count desc
  needsInsight.sort((a, b) => {
    const aCount = companyArticles.get(a.id)?.length ?? 0;
    const bCount = companyArticles.get(b.id)?.length ?? 0;
    return bCount - aCount;
  });

  const toGenerate = needsInsight.slice(0, MAX_PER_RUN);
  if (toGenerate.length === 0) {
    console.log('[CompanyInsights] All company insights are up to date');
    return [];
  }

  console.log(`[CompanyInsights] Generating insights for ${toGenerate.length} companies`);
  const results: CompanyInsight[] = [];

  for (const company of toGenerate) {
    try {
      const articles = companyArticles.get(company.id) ?? [];
      const insight = await generateSingleCompanyInsight(company, articles, env);
      if (insight) {
        await insertCompanyInsight(env.DB, insight);
        results.push(insight);
      }
    } catch (err) {
      console.error(`[CompanyInsights] Failed for ${company.name}:`, err);
    }
  }

  console.log(`[CompanyInsights] Generated ${results.length} company insights`);
  return results;
}

async function generateSingleCompanyInsight(
  company: Company,
  articles: Article[],
  env: Env,
): Promise<CompanyInsight | null> {
  const userMessage = buildUserMessage(company, articles);
  const markdown = await callClaudeAPI(userMessage, env);

  const trimmed = markdown.length > 2000 ? markdown.slice(0, 2000) : markdown;
  const contentHtml = markdownToHtml(trimmed);

  return {
    id: crypto.randomUUID(),
    companyId: company.id,
    content: trimmed,
    contentHtml,
    articleCount: articles.length,
    generatedAt: new Date().toISOString(),
  };
}

function buildUserMessage(company: Company, articles: Article[]): string {
  const lines: string[] = [
    `Company: ${company.name}`,
  ];
  if (company.description) lines.push(`Description: ${company.description}`);
  if (company.category) lines.push(`Category: ${company.category}`);
  if (company.website) lines.push(`Website: ${company.website}`);
  lines.push('');

  if (articles.length > 0) {
    lines.push(`Recent articles (${articles.length}):`);
    const toInclude = articles
      .slice()
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 20);
    for (const a of toInclude) {
      lines.push(`- "${a.title}" (${a.sourceName}, ${a.publishedAt.split('T')[0]})`);
      if (a.aiSummary) lines.push(`  Summary: ${a.aiSummary}`);
    }
  } else {
    lines.push('No articles available yet for this company.');
  }

  return lines.join('\n');
}

async function callClaudeAPI(userMessage: string, env: Env): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content?.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  return textBlock.text;
}
