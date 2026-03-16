import type { Env, CollectedArticle, Collector, SourceConfig } from './types';
import { rssCollector } from './collectors/rss';
import { createRedditCollector } from './collectors/reddit';
import { hackerNewsCollector } from './collectors/hackernews';
import { createYouTubeCollector } from './collectors/youtube';
import { arxivCollector } from './collectors/arxiv';
import { scoreArticles } from './scoring/classifier';
import {
  insertArticle,
  getArticleByUrl,
  getPublishedArticles,
  getFeaturedArticles,
  getAllActiveSources,
  getAllUniqueTags,
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
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize: strip trailing slash except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
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
    ctx: ExecutionContext
  ): Promise<void> {
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

    // 2. Collect articles from all sources (in parallel, grouped by type)
    const allCollected: CollectedArticle[] = [];
    const collectPromises = sources.map(async (source) => {
      const collector = getCollector(source.sourceType, env);
      if (!collector) {
        console.warn(`No collector for source type: ${source.sourceType}`);
        return;
      }

      try {
        const articles = await collector.collect(source);
        console.log(
          `Collected ${articles.length} articles from ${source.name}`
        );

        // Update source last fetched
        await updateSource(env.DB, source.id, {
          lastFetchedAt: new Date().toISOString(),
          errorCount: 0,
        });

        allCollected.push(...articles);
      } catch (err) {
        console.error(`Collector failed for ${source.name}:`, err);
        await updateSource(env.DB, source.id, {
          errorCount: source.errorCount + 1,
        });
      }
    });

    await Promise.all(collectPromises);
    console.log(`Total collected: ${allCollected.length} articles`);

    // 3. Deduplicate by URL — skip articles already in DB
    const newArticles: CollectedArticle[] = [];
    for (const article of allCollected) {
      try {
        const existing = await getArticleByUrl(env.DB, article.url);
        if (!existing) {
          newArticles.push(article);
        }
      } catch {
        // On DB error, skip dedup check and include article
        newArticles.push(article);
      }
    }
    console.log(`New articles after dedup: ${newArticles.length}`);

    // 4. Score new articles with Claude Haiku
    let scored = newArticles.map((a) => ({
      ...a,
      relevanceScore: 0,
      aiSummary: '',
      tags: [] as string[],
    }));

    if (newArticles.length > 0) {
      try {
        scored = await scoreArticles(newArticles, env);
        console.log(`Scored ${scored.length} articles`);
      } catch (err) {
        console.error('Scoring pipeline failed:', err);
        // Articles keep score 0 — they won't be published (below threshold)
      }
    }

    // 5. Store scored articles in D1
    let insertedCount = 0;
    for (const article of scored) {
      try {
        await insertArticle(env.DB, {
          id: generateId(),
          url: article.url,
          title: article.title,
          sourceType: article.sourceType,
          sourceName: article.sourceName,
          author: article.author,
          publishedAt: article.publishedAt,
          fetchedAt: new Date().toISOString(),
          contentSnippet: article.contentSnippet,
          imageUrl: article.imageUrl,
          relevanceScore: article.relevanceScore,
          aiSummary: article.aiSummary,
          tags: article.tags,
          isPublished: article.relevanceScore >= 40,
        });
        insertedCount++;
      } catch (err) {
        console.error(`Failed to insert article ${article.url}:`, err);
      }
    }
    console.log(`Inserted ${insertedCount} articles into D1`);

    // 6. Regenerate all HTML pages
    try {
      // Fetch all published articles for rendering (30-day window)
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const publishedArticles = await getPublishedArticles(env.DB, {
        limit: 1000,
        minScore: 40,
      });
      // Filter to 30-day window
      const recentArticles = publishedArticles.filter(
        (a) => a.publishedAt >= thirtyDaysAgo
      );
      const featuredArticles = await getFeaturedArticles(env.DB, 10);
      const tags = await getAllUniqueTags(env.DB);

      // Generate HTML pages
      const pages = generateAllPages(recentArticles, featuredArticles, tags);

      // Generate RSS feed
      const rssFeed = generateRssFeed(recentArticles.slice(0, 50));
      pages['/feed.xml'] = rssFeed;

      // Write all pages to KV
      const kvPromises = Object.entries(pages).map(([path, html]) =>
        env.KV.put(path, html)
      );
      await Promise.all(kvPromises);
      console.log(`Wrote ${Object.keys(pages).length} pages to KV`);
    } catch (err) {
      console.error('Page generation failed:', err);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Cron job completed in ${elapsed}ms. Collected: ${allCollected.length}, New: ${newArticles.length}, Inserted: ${insertedCount}`
    );
  },
};
