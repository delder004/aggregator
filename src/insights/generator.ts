/**
 * AI-powered insight summary generator.
 * Calls Claude Haiku to produce periodic briefings from scored articles.
 */

import type { Env, Article, InsightSummary, InsightPeriodType } from '../types';
import { markdownToHtml } from './markdown';
import { summaryExistsForPeriod, getArticlesInRange } from '../db/queries';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are a briefing writer for a news site about agentic AI in accounting.

Write a concise insight briefing in Markdown. Use these sections:

## Key Themes
2-4 bullet points identifying the major themes from the articles.

## Notable Developments
3-5 bullet points highlighting specific noteworthy articles by title.

## Trend Watch
1-2 sentences on emerging trends or patterns.

Rules:
- Keep the entire response under 1500 characters.
- Do NOT include a title — it will be added automatically.
- Use Markdown formatting: ## headings, - bullets, **bold** for emphasis, *italic* for article titles.
- Be specific and reference actual article titles when possible.
- Write in a professional, concise style suitable for accounting professionals.`;

interface PeriodWindow {
  periodType: InsightPeriodType;
  periodStart: string;
  periodEnd: string;
  title: string;
}

/**
 * Calculate all period windows that could be generated for the given time.
 * Returns all 5 period types; the pipeline checks DB existence before generating.
 */
export function getPeriodsToGenerate(now: Date): PeriodWindow[] {
  const periods: PeriodWindow[] = [];

  // Hourly: previous full hour
  {
    const end = new Date(now);
    end.setUTCMinutes(0, 0, 0);
    const start = new Date(end);
    start.setUTCHours(start.getUTCHours() - 1);

    const hourFormatted = formatHour(start);
    const dateFormatted = formatShortDate(start);
    periods.push({
      periodType: 'hourly',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      title: `Hourly Brief \u2014 ${dateFormatted}, ${hourFormatted}`,
    });
  }

  // Daily: previous calendar day (UTC)
  {
    const end = new Date(now);
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);

    const dateFormatted = formatShortDateWithYear(start);
    periods.push({
      periodType: 'daily',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      title: `Daily Digest \u2014 ${dateFormatted}`,
    });
  }

  // Weekly: previous Monday-to-Monday week (UTC)
  {
    const thisMonday = new Date(now);
    thisMonday.setUTCHours(0, 0, 0, 0);
    // Roll back to this Monday (or today if Monday)
    const dayOfWeek = thisMonday.getUTCDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    thisMonday.setUTCDate(thisMonday.getUTCDate() - daysToSubtract);

    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setUTCDate(lastSunday.getUTCDate() - 1);

    const startFormatted = formatShortDate(lastMonday);
    const endFormatted = formatShortDateWithYear(lastSunday);
    periods.push({
      periodType: 'weekly',
      periodStart: lastMonday.toISOString(),
      periodEnd: thisMonday.toISOString(),
      title: `Weekly Roundup \u2014 ${startFormatted}\u2013${endFormatted}`,
    });
  }

  // Monthly: previous calendar month
  {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const monthName = MONTHS[start.getUTCMonth()];
    periods.push({
      periodType: 'monthly',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      title: `Monthly Review \u2014 ${monthName} ${start.getUTCFullYear()}`,
    });
  }

  // Quarterly: previous quarter
  {
    const currentQuarter = Math.floor(now.getUTCMonth() / 3);
    const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const year = currentQuarter === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const startMonth = prevQuarter * 3;

    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 1));

    periods.push({
      periodType: 'quarterly',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      title: `Quarterly Report \u2014 Q${prevQuarter + 1} ${year}`,
    });
  }

  return periods;
}

/**
 * Generate a single insight summary for a given period and set of articles.
 * Returns null if generation fails (logs error, does not throw).
 */
export async function generateInsight(
  articles: Article[],
  period: PeriodWindow,
  env: Env,
): Promise<InsightSummary | null> {
  try {
    const userMessage = buildUserMessage(articles, period);
    const markdownContent = await callClaudeAPI(userMessage, env);

    // Truncate if too long (safety measure)
    const trimmed = markdownContent.length > 2000
      ? markdownContent.slice(0, 2000)
      : markdownContent;

    const contentHtml = markdownToHtml(trimmed);

    // Top articles: sorted by relevance, take top 5 IDs
    const topArticleIds = articles
      .slice()
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, 5)
      .map((a) => a.id);

    return {
      id: crypto.randomUUID(),
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      title: period.title,
      content: trimmed,
      contentHtml,
      articleCount: articles.length,
      topArticleIds,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `Failed to generate insight for ${period.periodType} (${period.title}):`,
      error,
    );
    return null;
  }
}

/**
 * Main entry point: generate insight summaries for all applicable periods.
 * Checks DB to avoid regenerating existing summaries.
 * Skips periods with fewer than 3 articles.
 */
export async function generateInsights(
  env: Env,
  now?: Date,
): Promise<InsightSummary[]> {
  const currentTime = now ?? new Date();
  const periods = getPeriodsToGenerate(currentTime);
  const results: InsightSummary[] = [];

  for (const period of periods) {
    try {
      // Check if summary already exists for this period
      const exists = await summaryExistsForPeriod(
        env.DB,
        period.periodType,
        period.periodStart,
      );
      if (exists) {
        console.log(`Insight already exists for ${period.periodType} ${period.periodStart}, skipping`);
        continue;
      }

      // Fetch articles in the period window
      const articles = await getArticlesInRange(
        env.DB,
        period.periodStart,
        period.periodEnd,
      );

      // Need at least 3 articles to generate a meaningful summary
      if (articles.length < 3) {
        console.log(
          `Only ${articles.length} articles for ${period.periodType} ${period.title}, skipping`,
        );
        continue;
      }

      const summary = await generateInsight(articles, period, env);
      if (summary) {
        results.push(summary);
      }
    } catch (error) {
      console.error(`Error processing period ${period.periodType}:`, error);
      // Continue to next period — one failure shouldn't block others
    }
  }

  return results;
}

// -- Internal helpers --

function buildUserMessage(articles: Article[], period: PeriodWindow): string {
  const lines: string[] = [
    `Period: ${period.title}`,
    `Articles: ${articles.length}`,
    '',
  ];

  // Include up to 30 articles with their details
  const articlesToInclude = articles
    .slice()
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, 30);

  for (const article of articlesToInclude) {
    lines.push(`- "${article.title}" (${article.sourceName})`);
    if (article.aiSummary) {
      lines.push(`  Summary: ${article.aiSummary}`);
    }
  }

  return lines.join('\n');
}

async function callClaudeAPI(userMessage: string, env: Env): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
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
    throw new Error(`Claude API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content?.find(
    (block) => block.type === 'text' && block.text,
  );
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  return textBlock.text;
}

// -- Date formatting helpers --

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format as "3:00 PM" */
function formatHour(date: Date): string {
  const hours = date.getUTCHours();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:00 ${period}`;
}

/** Format as "Mar 16" */
function formatShortDate(date: Date): string {
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Format as "Mar 15, 2026" */
function formatShortDateWithYear(date: Date): string {
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

