import type { Env, CollectedArticle, Collector, SourceConfig, Company, InsightSummary } from './types';
import { rssCollector } from './collectors/rss';
import { hackerNewsCollector } from './collectors/hackernews';
import { createYouTubeCollector } from './collectors/youtube';
import { arxivCollector } from './collectors/arxiv';
import { substackCollector } from './collectors/substack';
import { productHuntCollector } from './collectors/producthunt';
import { ycombinatorCollector } from './collectors/ycombinator';
import { companyBlogCollector } from './collectors/companyblog';
import { pressReleaseCollector } from './collectors/pressrelease';
import { scoreArticles, MIN_PUBLISH_SCORE } from './scoring/classifier';
import { extractContent } from './scoring/content-extractor';
import { getTrackedCompanies, matchArticleToCompanies, linkArticleToCompanies, updateCompanyStats } from './company/tracker';
import {
  getPublishedArticles,
  getFeaturedArticles,
  getAllActiveSources,
  getAllUniqueTags,
  getUnscoredArticles,
  updateArticleScore,
  updateSource,
  insertSummary,
  getAllRecentSummaries,
} from './db/queries';
import { generateAllPages } from './renderer/pages';
import { generateRssFeed } from './renderer/rss';
import { generateInsights } from './insights/generator';

function getCollector(
  sourceType: string,
  env: Env
): Collector | null {
  switch (sourceType) {
    case 'rss':
      return rssCollector;
    case 'hn':
      return hackerNewsCollector;
    case 'youtube':
      return createYouTubeCollector(env);
    case 'arxiv':
      return arxivCollector;
    case 'substack':
      return substackCollector;
    case 'producthunt':
      return productHuntCollector;
    case 'ycombinator':
      return ycombinatorCollector;
    case 'companyblog':
      return companyBlogCollector;
    case 'pressrelease':
      return pressReleaseCollector;
    default:
      return null;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize: strip trailing slash except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Manual cron trigger endpoint (authenticated via dedicated secret)
    if (path === '/cron') {
      const cronSecret = env.CRON_SECRET;
      if (!cronSecret || request.headers.get('X-Cron-Key') !== cronSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
      await runPipeline(env);
      return new Response('Cron completed', { status: 200 });
    }

    // Serve pre-rendered pages from KV
    const cached = await env.KV.get(path, 'text');
    if (cached) {
      const isXml = path.endsWith('.xml');
      return new Response(cached, {
        headers: {
          'Content-Type': isXml
            ? 'application/xml; charset=utf-8'
            : 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    await runPipeline(env);
  },
};

// Subrequest budget: Cloudflare Workers allow 1,000 subrequests per invocation.
// With 38+ sources (each a fetch), dedup queries, enrichment fetches, scoring API calls,
// DB inserts, backfill scoring, insight generation, company tracking, and page generation,
// the budget is tight. Lowered from 40 to 25 to leave headroom for other pipeline stages.
// Unscored articles are stored and picked up on subsequent runs via backfill.
const MAX_SCORE_PER_RUN = 25;

async function runPipeline(env: Env): Promise<void> {
    const startTime = Date.now();
    console.log('Cron job started');

    // 1. Get all active sources
    let sources: SourceConfig[];
    try {
      sources = await getAllActiveSources(env.DB);
    } catch (err) {
      console.error('Failed to load sources:', err);
      return;
    }
    console.log(`Loaded ${sources.length} active sources`);

    // 2. Collect articles from all sources in parallel
    const sourceUpdates: Array<{ id: string; lastFetchedAt?: string; errorCount: number }> = [];
    const collectResults = await Promise.all(
      sources.map(async (source): Promise<CollectedArticle[]> => {
        const collector = getCollector(source.sourceType, env);
        if (!collector) {
          console.warn(`No collector for source type: ${source.sourceType}`);
          return [];
        }

        try {
          const articles = await collector.collect(source);
          console.log(
            `Collected ${articles.length} articles from ${source.name}`
          );

          sourceUpdates.push({
            id: source.id,
            lastFetchedAt: new Date().toISOString(),
            errorCount: 0,
          });

          return articles;
        } catch (err) {
          console.error(`Collector failed for ${source.name}:`, err);
          sourceUpdates.push({
            id: source.id,
            errorCount: source.errorCount + 1,
          });
          return [];
        }
      })
    );

    // Batch all source updates into a single D1 call
    if (sourceUpdates.length > 0) {
      try {
        const stmts = sourceUpdates.map((u) => {
          if (u.lastFetchedAt) {
            return env.DB.prepare('UPDATE sources SET last_fetched_at = ?, error_count = ? WHERE id = ?')
              .bind(u.lastFetchedAt, u.errorCount, u.id);
          }
          return env.DB.prepare('UPDATE sources SET error_count = ? WHERE id = ?')
            .bind(u.errorCount, u.id);
        });
        await env.DB.batch(stmts);
      } catch (err) {
        console.error('Batch source update failed:', err);
      }
    }

    const allCollected = collectResults.flat();
    console.log(`Total collected: ${allCollected.length} articles`);

    // 3. Deduplicate by URL — batch query existing URLs from DB
    let newArticles: CollectedArticle[] = allCollected;
    try {
      const urls = allCollected.map((a) => a.url);
      const existingUrls = new Set<string>();
      for (let i = 0; i < urls.length; i += 100) {
        const batch = urls.slice(i, i + 100);
        const placeholders = batch.map(() => '?').join(',');
        const result = await env.DB
          .prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`)
          .bind(...batch)
          .all();
        for (const row of result.results) {
          existingUrls.add(row.url as string);
        }
      }
      newArticles = allCollected.filter((a) => !existingUrls.has(a.url));
    } catch (err) {
      console.error('Dedup query failed, treating all as new:', err);
    }
    console.log(`New articles after dedup: ${newArticles.length}`);

    // 3b. Enrich articles with fuller content before scoring
    // Cap at 10 to stay within subrequest limits (each enrichment is a fetch subrequest)
    const enrichLimit = Math.min(newArticles.length, 10);
    for (let i = 0; i < enrichLimit; i++) {
      if (!newArticles[i].contentSnippet || newArticles[i].contentSnippet!.length < 200) {
        try {
          const fullContent = await extractContent(newArticles[i].url);
          if (fullContent) {
            newArticles[i] = { ...newArticles[i], contentSnippet: fullContent };
          }
        } catch (err) {
          // Content extraction is best-effort — don't break the pipeline
          console.warn(`Content extraction failed for ${newArticles[i].url}:`, err);
        }
      }
    }

    // 4. Score new articles with Claude Haiku
    // Cap per-run to stay within Workers subrequest limits
    const toScore = newArticles.slice(0, MAX_SCORE_PER_RUN);
    const unscored = newArticles.slice(MAX_SCORE_PER_RUN);
    let scoredUsed = 0;

    let scored = toScore.map((a) => ({
      ...a,
      relevanceScore: 0,
      qualityScore: 0,
      aiSummary: '',
      tags: [] as string[],
      companyMentions: [] as string[],
    }));

    if (toScore.length > 0) {
      try {
        scored = await scoreArticles(toScore, env);
        scoredUsed = scored.length;
        console.log(`Scored ${scored.length} articles (${unscored.length} deferred to next run)`);
      } catch (err) {
        console.error('Scoring pipeline failed:', err);
      }
    }

    // Store unscored articles so they're deduped on next run
    // but won't appear on the site (below MIN_PUBLISH_SCORE threshold)
    const unscoredEntries = unscored.map((a) => ({
      ...a,
      relevanceScore: 0,
      qualityScore: 0,
      aiSummary: '',
      tags: [] as string[],
      companyMentions: [] as string[],
    }));
    const allToInsert = [...scored, ...unscoredEntries];

    // 5. Store articles in D1 (batched to reduce subrequests)
    let insertedCount = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < allToInsert.length; i += 50) {
      const batch = allToInsert.slice(i, i + 50);
      const stmts = batch.map((article) => {
        const wasScored = article.relevanceScore > 0 || article.aiSummary !== '';
        return env.DB
          .prepare(
            `INSERT OR IGNORE INTO articles
             (id, url, title, source_type, source_name, author, published_at, fetched_at,
              content_snippet, image_url, relevance_score, quality_score, social_score,
              comment_count, company_mentions, ai_summary, tags, is_published, scored_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            generateId(),
            article.url,
            article.title,
            article.sourceType,
            article.sourceName,
            article.author,
            article.publishedAt,
            now,
            article.contentSnippet,
            article.imageUrl,
            article.relevanceScore,
            article.qualityScore ?? null,
            article.socialScore ?? null,
            article.commentCount ?? null,
            JSON.stringify(article.companyMentions ?? []),
            article.aiSummary,
            JSON.stringify(article.tags),
            article.relevanceScore >= MIN_PUBLISH_SCORE ? 1 : 0,
            wasScored ? now : null
          );
      });
      try {
        await env.DB.batch(stmts);
        insertedCount += batch.length;
      } catch (err) {
        console.error(`Batch insert failed at offset ${i}:`, err);
      }
    }
    console.log(`Inserted ${insertedCount} articles into D1`);

    // 5b. Backfill scoring for previously unscored articles (shared cap)
    // Skip backfill if we already scored 15+ new articles this run to preserve subrequest budget
    const backfillBudget = MAX_SCORE_PER_RUN - scoredUsed;
    if (scoredUsed >= 15) {
      console.log(`Skipping backfill scoring: already scored ${scoredUsed} new articles this run (threshold: 15)`);
    } else if (backfillBudget > 0) {
      try {
        const unscoredFromDb = await getUnscoredArticles(env.DB, backfillBudget);
        if (unscoredFromDb.length > 0) {
          console.log(`Backfill scoring ${unscoredFromDb.length} unscored articles from DB`);
          const backfillInput = unscoredFromDb.map((a) => ({
            url: a.url,
            title: a.title,
            sourceType: a.sourceType,
            sourceName: a.sourceName,
            author: a.author,
            publishedAt: a.publishedAt,
            contentSnippet: a.contentSnippet,
            imageUrl: a.imageUrl,
          }));
          const backfillScored = await scoreArticles(backfillInput, env);
          // Batch all score updates into a single D1 call
          const updateStmts = backfillScored.map((s) =>
            env.DB.prepare(
              `UPDATE articles SET relevance_score = ?, ai_summary = ?, tags = ?, is_published = ?, scored_at = ?,
               quality_score = COALESCE(?, quality_score), company_mentions = COALESCE(?, company_mentions)
               WHERE url = ?`
            ).bind(
              s.relevanceScore,
              s.aiSummary,
              JSON.stringify(s.tags),
              s.relevanceScore >= MIN_PUBLISH_SCORE ? 1 : 0,
              now,
              s.qualityScore ?? null,
              s.companyMentions ? JSON.stringify(s.companyMentions) : null,
              s.url
            )
          );
          if (updateStmts.length > 0) {
            await env.DB.batch(updateStmts);
          }
          console.log(`Backfill scored ${backfillScored.length} articles`);
        }
      } catch (err) {
        console.error('Backfill scoring failed:', err);
      }
    }

    // 5c. Company tracking — match scored articles to tracked companies
    let companies: Company[] = [];
    try {
      companies = await getTrackedCompanies(env.DB);
      if (companies.length > 0 && scored.length > 0) {
        // Build URL-to-matches map first (no DB calls)
        const urlToMatches = new Map<string, string[]>();
        for (const article of scored) {
          const matched = matchArticleToCompanies(article, companies);
          if (matched.length > 0) {
            urlToMatches.set(article.url, matched);
          }
        }

        if (urlToMatches.size > 0) {
          // Batch lookup article IDs by URL (same pattern as dedup step)
          const urls = [...urlToMatches.keys()];
          const urlToId = new Map<string, string>();
          for (let i = 0; i < urls.length; i += 100) {
            const batch = urls.slice(i, i + 100);
            const placeholders = batch.map(() => '?').join(',');
            const result = await env.DB
              .prepare(`SELECT id, url FROM articles WHERE url IN (${placeholders})`)
              .bind(...batch)
              .all();
            for (const row of result.results) {
              urlToId.set(row.url as string, row.id as string);
            }
          }

          // Link articles to companies and collect matched company IDs
          const matchedCompanyIds = new Set<string>();
          for (const [url, companyIds] of urlToMatches) {
            const articleId = urlToId.get(url);
            if (articleId) {
              await linkArticleToCompanies(env.DB, articleId, companyIds);
              companyIds.forEach((id) => matchedCompanyIds.add(id));
            }
          }

          // Update stats for all matched companies
          for (const companyId of matchedCompanyIds) {
            await updateCompanyStats(env.DB, companyId);
          }
        }
        console.log(`Company tracking complete for ${scored.length} articles against ${companies.length} companies`);
      }
    } catch (err) {
      console.error('Company tracking failed:', err);
    }

    // 5d. Generate insight summaries
    // Skip if scoring consumed significant budget (20+ articles) to save ~10 subrequests
    let summaries: InsightSummary[] = [];
    if (scoredUsed >= 20) {
      console.log(`Skipping insight generation: scored ${scoredUsed} articles this run, preserving subrequest budget (threshold: 20)`);
    } else {
      try {
        const generated = await generateInsights(env);
        if (generated.length > 0) {
          for (const summary of generated) {
            await insertSummary(env.DB, summary);
          }
          console.log(`Generated ${generated.length} insight summaries`);
        }
      } catch (err) {
        console.error('Insight generation failed:', err);
      }
    }

    // 6. Regenerate all HTML pages
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const publishedArticles = await getPublishedArticles(env.DB, {
        limit: 1000,
        minScore: MIN_PUBLISH_SCORE,
      });
      const recentArticles = publishedArticles.filter(
        (a) => a.publishedAt >= thirtyDaysAgo
      );
      const featuredArticles = await getFeaturedArticles(env.DB, 10);
      const tags = await getAllUniqueTags(env.DB);

      const totalArticles = recentArticles.length;
      const lastUpdated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      // Refresh company list for page generation (stats may have updated)
      let companiesForPages = companies;
      try {
        if (companiesForPages.length === 0) {
          companiesForPages = await getTrackedCompanies(env.DB);
        }
      } catch {
        // Use whatever we already have
      }

      // Fetch all recent summaries for insights pages
      try {
        summaries = await getAllRecentSummaries(env.DB);
      } catch (err) {
        console.error('Failed to fetch summaries:', err);
      }

      const pages = generateAllPages(recentArticles, featuredArticles, tags, {
        sources: sources.length,
        articles: totalArticles,
        lastUpdated,
      }, summaries, companiesForPages);

      const rssFeed = generateRssFeed(recentArticles.slice(0, 50));
      pages['/feed.xml'] = rssFeed;

      // Write pages to KV in batches of 25
      const entries = Object.entries(pages);
      for (let i = 0; i < entries.length; i += 25) {
        const batch = entries.slice(i, i + 25);
        await Promise.all(batch.map(([path, html]) => env.KV.put(path, html)));
      }
      console.log(`Wrote ${entries.length} pages to KV`);
    } catch (err) {
      console.error('Page generation failed:', err);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Cron job completed in ${elapsed}ms. Collected: ${allCollected.length}, New: ${newArticles.length}, Inserted: ${insertedCount}`
    );
}
