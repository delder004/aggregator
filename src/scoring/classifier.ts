import type { CollectedArticle, ScoredArticle, Env } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const ALLOWED_TAGS = new Set([
  'audit',
  'tax',
  'bookkeeping',
  'compliance',
  'payroll',
  'invoicing',
  'fraud-detection',
  'financial-reporting',
  'agentic-ai',
  'llm',
  'automation',
  'startup',
  'big-4',
  'regulation',
  'case-study',
  'opinion',
  'research',
]);

const SYSTEM_PROMPT = `You are a content classifier for a news site about agentic AI in accounting.

Score this article's relevance from 0-100:
- 90-100: Directly about AI agents in accounting/bookkeeping/audit/tax
- 70-89: About AI in finance/accounting broadly
- 50-69: About agentic AI generally (applicable to accounting)
- 30-49: About AI or accounting separately, tangentially related
- 0-29: Not relevant

Also provide:
- tags: up to 5 from [audit, tax, bookkeeping, compliance, payroll, invoicing, fraud-detection, financial-reporting, agentic-ai, llm, automation, startup, big-4, regulation, case-study, opinion, research]
- summary: 1-2 sentences for the feed (under 280 characters)

Respond with valid JSON only, no other text. Use this exact schema:
{
  "relevanceScore": <number 0-100>,
  "tags": [<string>, ...],
  "summary": "<string>"
}`;

interface ClassifierResponse {
  relevanceScore: number;
  tags: string[];
  summary: string;
}

/**
 * Score a batch of collected articles using Claude Haiku.
 * Each article is scored individually via a separate API call.
 * On error, retries once, then assigns score 0.
 */
export async function scoreArticles(
  articles: CollectedArticle[],
  env: Env
): Promise<ScoredArticle[]> {
  const results: ScoredArticle[] = [];

  for (const article of articles) {
    try {
      const scored = await scoreOneArticle(article, env);
      results.push(scored);
    } catch (error) {
      console.error(
        `Failed to score article "${article.title}" after retry:`,
        error
      );
      // Assign score 0 on complete failure
      results.push({
        ...article,
        relevanceScore: 0,
        aiSummary: '',
        tags: [],
      });
    }
  }

  return results;
}

/**
 * Score a single article via the Claude API.
 * Retries once on failure before throwing.
 */
async function scoreOneArticle(
  article: CollectedArticle,
  env: Env
): Promise<ScoredArticle> {
  const userMessage = buildUserMessage(article);

  // First attempt
  try {
    const response = await callClaudeAPI(userMessage, env);
    const parsed = parseAndValidateResponse(response);
    return {
      ...article,
      relevanceScore: parsed.relevanceScore,
      aiSummary: parsed.summary,
      tags: parsed.tags,
    };
  } catch (firstError) {
    console.warn(
      `First scoring attempt failed for "${article.title}", retrying:`,
      firstError
    );
  }

  // Retry once
  const response = await callClaudeAPI(userMessage, env);
  const parsed = parseAndValidateResponse(response);
  return {
    ...article,
    relevanceScore: parsed.relevanceScore,
    aiSummary: parsed.summary,
    tags: parsed.tags,
  };
}

function buildUserMessage(article: CollectedArticle): string {
  const parts = [
    `Title: ${article.title}`,
    `Source: ${article.sourceName}`,
  ];

  if (article.contentSnippet) {
    parts.push(`Content: ${article.contentSnippet}`);
  }

  return parts.join('\n');
}

/**
 * Call the Anthropic Messages API and return the raw text content.
 */
async function callClaudeAPI(userMessage: string, env: Env): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
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
    throw new Error(
      `Claude API returned ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  // Extract text from the response content blocks
  const textBlock = data.content?.find(
    (block) => block.type === 'text' && block.text
  );
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  return textBlock.text;
}

/**
 * Parse the JSON response from Claude and validate all fields.
 * Clamps relevanceScore to 0-100, filters unknown tags,
 * and truncates summary to 280 characters.
 */
function parseAndValidateResponse(rawText: string): ClassifierResponse {
  // Strip markdown code fences if the model wraps the JSON
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    // Remove opening fence (with optional language identifier)
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    // Remove closing fence
    cleaned = cleaned.replace(/\n?```$/, '');
    cleaned = cleaned.trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse classifier JSON: ${rawText}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Classifier response is not an object: ${rawText}`);
  }

  const obj = parsed as Record<string, unknown>;

  // Validate and clamp relevanceScore
  let relevanceScore = 0;
  if (typeof obj.relevanceScore === 'number') {
    relevanceScore = Math.round(obj.relevanceScore);
    relevanceScore = Math.max(0, Math.min(100, relevanceScore));
  } else {
    throw new Error(
      `relevanceScore is not a number: ${JSON.stringify(obj.relevanceScore)}`
    );
  }

  // Validate tags — keep only allowed tags
  let tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    tags = obj.tags
      .filter((tag): tag is string => typeof tag === 'string')
      .filter((tag) => ALLOWED_TAGS.has(tag))
      .slice(0, 5);
  }

  // Validate summary
  let summary = '';
  if (typeof obj.summary === 'string' && obj.summary.trim().length > 0) {
    summary = obj.summary.trim();
    if (summary.length > 280) {
      summary = summary.slice(0, 277) + '...';
    }
  } else {
    throw new Error(
      `summary is empty or not a string: ${JSON.stringify(obj.summary)}`
    );
  }

  return { relevanceScore, tags, summary };
}
