import type { CollectedArticle, CompanyMention, ScoredArticle, Env } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/** Minimum relevance score for an article to be published on the site. */
export const MIN_PUBLISH_SCORE = 50;

export const ALLOWED_TAGS = new Set([
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
  'product-launch',
  'funding',
  'partnership',
  'integration',
  'open-source',
]);

const SYSTEM_PROMPT = `You are a strict content classifier for agenticaiccounting.com, a niche news aggregator focused specifically on the intersection of AI/automation AND accounting/audit/tax/bookkeeping.

CRITICAL: Content MUST be about BOTH artificial intelligence AND accounting to score well. Articles about only AI (without accounting) or only accounting (without AI) should score LOW.

Score this article on TWO dimensions:

## Relevance Score (0-100): How relevant is this to AI in accounting?
- 90-100: Directly about AI agents/automation in accounting, bookkeeping, audit, or tax (e.g., "Deloitte deploys AI agents for audit", "AI-powered bookkeeping startup raises Series A")
- 70-89: AI applied to accounting-adjacent finance with clear accounting implications (e.g., "AI fraud detection in accounts payable", "LLM for financial reporting")
- 50-69: AI in broader finance/fintech with indirect accounting relevance (e.g., "AI in banking compliance" — related but not core accounting)
- 30-49: Only about AI generally OR only about accounting, not both. Tangential at best.
- 0-29: Not relevant to either AI or accounting, or relevant to only one with no connection to the other

## STRICT SCORING RULES — read carefully:
- Generic AI news (new models, AI policy, general AI capabilities) with NO mention of accounting/audit/tax/bookkeeping → score 0-25 max
- General AI newsletters or commentary (e.g., Import AI, AI news roundups) → score 0-20 unless a specific article is about accounting
- Accounting news with no AI/automation angle → score 20-35 max
- Fintech/banking AI without accounting specifics → score 30-45 max
- The article must EXPLICITLY discuss accounting, audit, tax, bookkeeping, CPA, or financial reporting AND AI/automation/agents to score above 50

## Quality Score (0-100): How good is this content editorially?
- 90-100: Original research, deep analysis, exclusive reporting, primary sources
- 70-89: Well-written analysis, expert commentary, good case studies
- 50-69: Standard news coverage, press releases, product announcements
- 30-49: Listicles, shallow takes, SEO content, rehashed news
- 0-29: Spam, clickbait, ads, very low effort

## Format Penalties (apply to quality score):
- Podcast episodes: cap quality at 60 max UNLESS a transcript is provided, in which case score based on actual content quality
- YouTube videos: cap quality at 60 max UNLESS a transcript is provided, in which case score based on actual content quality
- Podcast/video content that is a deep expert interview specifically about AI in accounting may score up to 75

## Recency & Freshness
- Breaking news about specific company actions, product launches, or regulatory changes should score +10-15 relevance over generic evergreen content
- If the content is time-sensitive (e.g., a new product launch, regulatory deadline, funding round), note this in the summary

## Social Signals
When social engagement metrics are provided (upvotes, comments), factor community validation into the quality score. High engagement from technical communities (Hacker News, specialized subreddits) suggests higher quality content.

Also provide:
- tags: up to 5 from [audit, tax, bookkeeping, compliance, payroll, invoicing, fraud-detection, financial-reporting, agentic-ai, llm, automation, startup, big-4, regulation, case-study, opinion, research, product-launch, funding, partnership, integration, open-source]
- headline: Write a concise, journalist-style headline under 80 characters. Remove dates, author names, site names, and the word "Article". Use active voice, present tense where possible.
- summary: A punchy 1-sentence TLDR that tells the reader "so what" — the key takeaway or news, not a description. Under 200 characters. Use specifics (numbers, names, outcomes) over vague descriptions. Bad: "Overview of AI benefits for accounting teams." Good: "GPT-5.4 tops DualEntry's accounting benchmark at 77% but still fails 1 in 3 tasks."
- companyMentions: array of companies mentioned. For each, provide an object with "name" (required) and optionally "website" (just the domain, e.g., "truewind.ai") if a URL or domain appears in the article. Example: [{"name": "Truewind", "website": "truewind.ai"}, {"name": "Deloitte"}]. Empty array if none.
- transcriptSummary: ONLY include this field when a Transcript is provided. Write a structured summary with: (1) a "TLDW:" line — a single-sentence takeaway, (2) followed by "Key points:" with 3-5 bullet points capturing the most important insights from the transcript. Each bullet should be a concrete, specific fact or insight (not vague). Use "- " for bullets. Omit this field entirely if no transcript is provided.

Respond with valid JSON only, no other text. Use this exact schema:
{
  "relevanceScore": <number 0-100>,
  "qualityScore": <number 0-100>,
  "tags": [<string>, ...],
  "headline": "<string>",
  "summary": "<string>",
  "companyMentions": [{"name": "<string>", "website": "<string> (optional)"}, ...],
  "transcriptSummary": "<string> (only when transcript provided)"
}`;

interface ClassifierResponse {
  relevanceScore: number;
  qualityScore: number;
  tags: string[];
  summary: string;
  headline: string;
  companyMentions: string[];
  enrichedCompanyMentions?: CompanyMention[];
  transcriptSummary?: string;
}

const CONCURRENCY = 10;

/** Optional social signal data that can be attached to articles before scoring. */
export interface SocialSignals {
  upvotes?: number;
  comments?: number;
}

/**
 * Score a batch of collected articles using Claude Haiku.
 * Runs up to CONCURRENCY API calls in parallel for speed.
 * On error, retries once, then assigns score 0.
 */
export async function scoreArticles(
  articles: CollectedArticle[],
  env: Env,
  socialSignalsMap?: Map<string, SocialSignals>
): Promise<ScoredArticle[]> {
  const results: ScoredArticle[] = new Array(articles.length);

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const chunk = articles.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (article) => {
      try {
        const signals = socialSignalsMap?.get(article.url);
        return await scoreOneArticle(article, env, signals);
      } catch (error) {
        console.error(
          `Failed to score article "${article.title}" after retry:`,
          error
        );
        return {
          ...article,
          relevanceScore: 0,
          qualityScore: 0,
          aiSummary: '',
          headline: '',
          tags: [],
          companyMentions: [],
        };
      }
    });
    const scored = await Promise.all(promises);
    for (let j = 0; j < scored.length; j++) {
      results[i + j] = scored[j];
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
  env: Env,
  signals?: SocialSignals
): Promise<ScoredArticle> {
  const userMessage = buildUserMessage(article, signals);

  // First attempt
  try {
    const response = await callClaudeAPI(userMessage, env);
    const parsed = parseAndValidateResponse(response);
    return {
      ...article,
      relevanceScore: parsed.relevanceScore,
      qualityScore: parsed.qualityScore,
      aiSummary: parsed.summary,
      headline: parsed.headline,
      tags: parsed.tags,
      companyMentions: parsed.companyMentions,
      enrichedCompanyMentions: parsed.enrichedCompanyMentions,
      transcriptSummary: parsed.transcriptSummary,
    };
  } catch (firstError) {
    // Don't retry on subrequest limit — it will always fail again
    if (firstError instanceof Error && firstError.message.includes('Too many subrequests')) {
      throw firstError;
    }
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
    qualityScore: parsed.qualityScore,
    aiSummary: parsed.summary,
    headline: parsed.headline,
    tags: parsed.tags,
    companyMentions: parsed.companyMentions,
    enrichedCompanyMentions: parsed.enrichedCompanyMentions,
    transcriptSummary: parsed.transcriptSummary,
  };
}

/**
 * Build the user message sent to Claude for classification.
 * Includes title, source, author, content, social signals, and published date.
 */
export function buildUserMessage(
  article: CollectedArticle,
  signals?: SocialSignals
): string {
  const parts: string[] = [
    `Title: ${article.title}`,
    `Source: ${article.sourceName} (${article.sourceType})`,
  ];

  if (article.author) {
    parts.push(`Author: ${article.author}`);
  }

  if (article.contentSnippet) {
    parts.push(`Content: ${article.contentSnippet}`);
  }

  if (signals && (signals.upvotes !== undefined || signals.comments !== undefined)) {
    const signalParts: string[] = [];
    if (signals.upvotes !== undefined) {
      signalParts.push(`${signals.upvotes} upvotes`);
    }
    if (signals.comments !== undefined) {
      signalParts.push(`${signals.comments} comments`);
    }
    parts.push(`Social: ${signalParts.join(', ')}`);
  }

  if (article.transcript) {
    // Include truncated transcript (first 3000 chars) for better scoring
    const truncatedTranscript = article.transcript.length > 3000
      ? article.transcript.slice(0, 3000) + '...'
      : article.transcript;
    parts.push(`Transcript: ${truncatedTranscript}`);
  }

  parts.push(`Published: ${article.publishedAt}`);

  return parts.join('\n');
}

/**
 * Call the Anthropic Messages API and return the raw text content.
 */
async function callClaudeAPI(userMessage: string, env: Env): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 1024,
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
 * Clamps scores to 0-100, filters unknown tags,
 * truncates summary to 280 characters, and validates companyMentions.
 */
export function parseAndValidateResponse(rawText: string): ClassifierResponse {
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

  // Validate and clamp qualityScore
  let qualityScore = 0;
  if (typeof obj.qualityScore === 'number') {
    qualityScore = Math.round(obj.qualityScore);
    qualityScore = Math.max(0, Math.min(100, qualityScore));
  } else {
    throw new Error(
      `qualityScore is not a number: ${JSON.stringify(obj.qualityScore)}`
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
    if (summary.length > 200) {
      summary = summary.slice(0, 197) + '...';
    }
  } else {
    throw new Error(
      `summary is empty or not a string: ${JSON.stringify(obj.summary)}`
    );
  }

  // Validate headline
  let headline = '';
  if (typeof obj.headline === 'string' && obj.headline.trim().length > 0) {
    headline = obj.headline.trim();
    if (headline.length > 80) {
      headline = headline.slice(0, 77) + '...';
    }
  }

  // Validate companyMentions — accept both [{name, website?}] and [string] formats
  let companyMentions: string[] = [];
  let enrichedCompanyMentions: CompanyMention[] | undefined;
  if (Array.isArray(obj.companyMentions)) {
    const firstItem = obj.companyMentions[0];
    const isStructured =
      obj.companyMentions.length > 0 &&
      typeof firstItem === 'object' &&
      firstItem !== null;

    if (isStructured) {
      enrichedCompanyMentions = [];
      for (const item of obj.companyMentions) {
        if (typeof item === 'object' && item !== null) {
          const entry = item as Record<string, unknown>;
          const name =
            typeof entry.name === 'string' ? entry.name.trim() : '';
          if (name.length > 0) {
            const website =
              typeof entry.website === 'string'
                ? entry.website.trim()
                : undefined;
            companyMentions.push(name);
            enrichedCompanyMentions.push({
              name,
              website: website || undefined,
            });
          }
        } else if (typeof item === 'string' && item.trim().length > 0) {
          // Mixed array — treat plain strings as name-only
          companyMentions.push(item.trim());
          enrichedCompanyMentions.push({ name: item.trim() });
        }
      }
    } else {
      companyMentions = obj.companyMentions
        .filter(
          (name): name is string =>
            typeof name === 'string' && name.trim().length > 0
        )
        .map((name) => name.trim());
    }
  }

  // Validate optional transcriptSummary
  let transcriptSummary: string | undefined;
  if (typeof obj.transcriptSummary === 'string' && obj.transcriptSummary.trim().length > 0) {
    transcriptSummary = obj.transcriptSummary.trim();
    if (transcriptSummary.length > 2000) {
      transcriptSummary = transcriptSummary.slice(0, 2000);
    }
  }

  return { relevanceScore, qualityScore, tags, summary, headline, companyMentions, enrichedCompanyMentions, transcriptSummary };
}
