import type { Env, CollectedArticle, Collector, SourceConfig } from './types';
import { rssCollector } from './collectors/rss';
import { createRedditCollector } from './collectors/reddit';
import { hackerNewsCollector } from './collectors/hackernews';
import { createYouTubeCollector } from './collectors/youtube';
import { arxivCollector } from './collectors/arxiv';
import { scoreArticles } from './scoring/classifier';
import {
  getPublishedArticles,
  getFeaturedArticles,
  getAllActiveSources,
  getAllUniqueTags,
  getUnscoredArticles,
  updateArticleScore,
  updateSource,
} from './db/queries';
import { generateAllPages } from './renderer/pages';
import { generateRssFeed } from './renderer/rss';

function getCollector(
  sourceType: string,
  env: Env
): Collector | null {
  switch (sourceType) {
    case 'rss':
      return rssCollector;
    case 'reddit':
      return createRedditCollector(env);
    case 'hn':
      return hackerNewsCollector;
    case 'youtube':
      return createYouTubeCollector(env);
    case 'arxiv':
      return arxivCollector;
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

const MAX_SCORE_PER_RUN = 100;

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

          await updateSource(env.DB, source.id, {
            lastFetchedAt: new Date().toISOString(),
            errorCount: 0,
          });

          return articles;
        } catch (err) {
          console.error(`Collector failed for ${source.name}:`, err);
          await updateSource(env.DB, source.id, {
            errorCount: source.errorCount + 1,
          });
          return [];
        }
      })
    );

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
    // but won't appear on the site (below 40 threshold)
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
              content_snippet, image_url, relevance_score, ai_summary, tags, is_published, scored_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            article.aiSummary,
            JSON.stringify(article.tags),
            article.relevanceScore >= 40 ? 1 : 0,
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
    const backfillBudget = MAX_SCORE_PER_RUN - scoredUsed;
    if (backfillBudget > 0) {
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
          for (const s of backfillScored) {
            await updateArticleScore(
              env.DB,
              s.url,
              s.relevanceScore,
              s.aiSummary,
              s.tags,
              s.relevanceScore >= 40
            );
          }
          console.log(`Backfill scored ${backfillScored.length} articles`);
        }
      } catch (err) {
        console.error('Backfill scoring failed:', err);
      }
    }

    // 6. Regenerate all HTML pages
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const publishedArticles = await getPublishedArticles(env.DB, {
        limit: 1000,
        minScore: 40,
      });
      const recentArticles = publishedArticles.filter(
        (a) => a.publishedAt >= thirtyDaysAgo
      );
      const featuredArticles = await getFeaturedArticles(env.DB, 10);
      const tags = await getAllUniqueTags(env.DB);

      const totalArticles = recentArticles.length;
      const lastUpdated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      const pages = generateAllPages(recentArticles, featuredArticles, tags, {
        sources: sources.length,
        articles: totalArticles,
        lastUpdated,
      });

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
