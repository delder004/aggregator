import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env, CollectedArticle, Collector, SourceConfig, ScoredArticle, Company, InsightSummary, SourceType } from './types';
import { rssCollector } from './collectors/rss';
import { hackerNewsCollector } from './collectors/hackernews';
import { createYouTubeCollector } from './collectors/youtube';
import { arxivCollector } from './collectors/arxiv';
import { substackCollector } from './collectors/substack';
import { productHuntCollector } from './collectors/producthunt';
import { ycombinatorCollector } from './collectors/ycombinator';
import { companyBlogCollector } from './collectors/companyblog';
import { pressReleaseCollector } from './collectors/pressrelease';
import { blogScraperCollector } from './collectors/blogscraper';
import { scoreArticles, MIN_PUBLISH_SCORE } from './scoring/classifier';
import { extractContent } from './scoring/content-extractor';
import { getTrackedCompanies, matchArticleToCompanies, linkArticleToCompanies, updateCompanyStats } from './company/tracker';
import {
  getPublishedArticles,
  getFeaturedArticles,
  getAllActiveSources,
  getAllUniqueTags,
  getUnscoredArticles,
  insertSummary,
  getAllRecentSummaries,
} from './db/queries';
import { generateAllPages } from './renderer/pages';
import { generateRssFeed } from './renderer/rss';
import { generateInsights } from './insights/generator';

const MAX_SCORE_PER_RUN = 50;
const ENRICH_LIMIT = 20;

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
    case 'blogscraper':
      return blogScraperCollector;
    default:
      return null;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getRecentlyScoredArticles(db: D1Database, since: string): Promise<ScoredArticle[]> {
  const results = await db
    .prepare('SELECT * FROM articles WHERE scored_at >= ? AND relevance_score > 0')
    .bind(since)
    .all();
  return results.results.map((row) => ({
    url: row.url as string,
    title: row.title as string,
    sourceType: row.source_type as SourceType,
    sourceName: row.source_name as string,
    author: row.author as string | null,
    publishedAt: row.published_at as string,
    contentSnippet: row.content_snippet as string | null,
    imageUrl: row.image_url as string | null,
    relevanceScore: row.relevance_score as number,
    qualityScore: (row.quality_score as number) ?? 0,
    aiSummary: (row.ai_summary as string) ?? '',
    tags: JSON.parse((row.tags as string) || '[]'),
    companyMentions: JSON.parse((row.company_mentions as string) || '[]'),
  }));
}

export class PipelineWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep) {
    const startTime = Date.now();
    const startTimeISO = new Date(startTime).toISOString();
    console.log('Pipeline workflow started');

    // Step 1: Collect and store articles
    const collection = await step.do(
      'collect-and-store',
      {
        retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
      },
      async () => {
        // 1. Get all active sources
        let sources: SourceConfig[];
        try {
          sources = await getAllActiveSources(this.env.DB);
        } catch (err) {
          console.error('Failed to load sources:', err);
          return { collected: 0, new: 0, scored: 0, inserted: 0, sourceCount: 0 };
        }
        console.log(`Loaded ${sources.length} active sources`);

        // 2. Collect articles from all sources in parallel
        const sourceUpdates: Array<{ id: string; lastFetchedAt?: string; errorCount: number }> = [];
        const collectResults = await Promise.all(
          sources.map(async (source): Promise<CollectedArticle[]> => {
            const collector = getCollector(source.sourceType, this.env);
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
                return this.env.DB.prepare('UPDATE sources SET last_fetched_at = ?, error_count = ? WHERE id = ?')
                  .bind(u.lastFetchedAt, u.errorCount, u.id);
              }
              return this.env.DB.prepare('UPDATE sources SET error_count = ? WHERE id = ?')
                .bind(u.errorCount, u.id);
            });
            await this.env.DB.batch(stmts);
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
            const result = await this.env.DB
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
        const enrichLimit = Math.min(newArticles.length, ENRICH_LIMIT);
        for (let i = 0; i < enrichLimit; i++) {
          if (!newArticles[i].contentSnippet || newArticles[i].contentSnippet!.length < 200) {
            try {
              const fullContent = await extractContent(newArticles[i].url);
              if (fullContent) {
                newArticles[i] = { ...newArticles[i], contentSnippet: fullContent };
              }
            } catch (err) {
              console.warn(`Content extraction failed for ${newArticles[i].url}:`, err);
            }
          }
        }

        // 4. Score new articles with Claude Haiku
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
            scored = await scoreArticles(toScore, this.env);
            scoredUsed = scored.length;
            console.log(`Scored ${scored.length} articles (${unscored.length} deferred to next run)`);
          } catch (err) {
            console.error('Scoring pipeline failed:', err);
          }
        }

        // Store unscored articles so they're deduped on next run
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
            return this.env.DB
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
            await this.env.DB.batch(stmts);
            insertedCount += batch.length;
          } catch (err) {
            console.error(`Batch insert failed at offset ${i}:`, err);
          }
        }
        console.log(`Inserted ${insertedCount} articles into D1`);

        return {
          collected: allCollected.length,
          new: newArticles.length,
          scored: scoredUsed,
          inserted: insertedCount,
          sourceCount: sources.length,
        };
      }
    );

    // Step 2: Backfill scoring for previously unscored articles
    const backfill = await step.do(
      'backfill-scoring',
      {
        retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
      },
      async () => {
        const backfillBudget = MAX_SCORE_PER_RUN - collection.scored;
        if (backfillBudget <= 0) {
          console.log('No backfill budget remaining');
          return { backfilled: 0 };
        }

        try {
          const unscoredFromDb = await getUnscoredArticles(this.env.DB, backfillBudget);
          if (unscoredFromDb.length === 0) {
            console.log('No unscored articles to backfill');
            return { backfilled: 0 };
          }

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
          const backfillScored = await scoreArticles(backfillInput, this.env);
          const now = new Date().toISOString();
          // Batch all score updates into a single D1 call
          const updateStmts = backfillScored.map((s) =>
            this.env.DB.prepare(
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
            await this.env.DB.batch(updateStmts);
          }
          console.log(`Backfill scored ${backfillScored.length} articles`);
          return { backfilled: backfillScored.length };
        } catch (err) {
          console.error('Backfill scoring failed:', err);
          return { backfilled: 0 };
        }
      }
    );

    // Step 3: Company tracking
    const companyTracking = await step.do(
      'company-tracking',
      {
        retries: { limit: 1, delay: '5 seconds' },
      },
      async () => {
        try {
          const companies = await getTrackedCompanies(this.env.DB);
          if (companies.length === 0) {
            console.log('No tracked companies found');
            return { matched: 0 };
          }

          const recentlyScored = await getRecentlyScoredArticles(this.env.DB, startTimeISO);
          if (recentlyScored.length === 0) {
            console.log('No recently scored articles for company tracking');
            return { matched: 0 };
          }

          // Build URL-to-matches map first (no DB calls)
          const urlToMatches = new Map<string, string[]>();
          for (const article of recentlyScored) {
            const matched = matchArticleToCompanies(article, companies);
            if (matched.length > 0) {
              urlToMatches.set(article.url, matched);
            }
          }

          if (urlToMatches.size === 0) {
            console.log('No company matches found');
            return { matched: 0 };
          }

          // Batch lookup article IDs by URL
          const urls = [...urlToMatches.keys()];
          const urlToId = new Map<string, string>();
          for (let i = 0; i < urls.length; i += 100) {
            const batch = urls.slice(i, i + 100);
            const placeholders = batch.map(() => '?').join(',');
            const result = await this.env.DB
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
              await linkArticleToCompanies(this.env.DB, articleId, companyIds);
              companyIds.forEach((id) => matchedCompanyIds.add(id));
            }
          }

          // Update stats for all matched companies
          for (const companyId of matchedCompanyIds) {
            await updateCompanyStats(this.env.DB, companyId);
          }

          console.log(`Company tracking complete: ${urlToMatches.size} articles matched against ${companies.length} companies`);
          return { matched: urlToMatches.size };
        } catch (err) {
          console.error('Company tracking failed:', err);
          return { matched: 0 };
        }
      }
    );

    // Step 4: Generate insights
    const insights = await step.do(
      'generate-insights',
      {
        retries: { limit: 1, delay: '5 seconds' },
      },
      async () => {
        try {
          const generated = await generateInsights(this.env);
          if (generated.length > 0) {
            for (const summary of generated) {
              await insertSummary(this.env.DB, summary);
            }
            console.log(`Generated ${generated.length} insight summaries`);
          }
          return { generated: generated.length };
        } catch (err) {
          console.error('Insight generation failed:', err);
          return { generated: 0 };
        }
      }
    );

    // Step 5: Render pages
    const rendering = await step.do(
      'render-pages',
      {
        retries: { limit: 2, delay: '5 seconds', backoff: 'linear' },
      },
      async () => {
        try {
          const ninetyDaysAgo = new Date(
            Date.now() - 90 * 24 * 60 * 60 * 1000
          ).toISOString();
          const publishedArticles = await getPublishedArticles(this.env.DB, {
            limit: 1000,
            minScore: MIN_PUBLISH_SCORE,
          });
          const recentArticles = publishedArticles.filter(
            (a) => a.publishedAt >= ninetyDaysAgo
          );
          const featuredArticles = await getFeaturedArticles(this.env.DB, 10);
          const tags = await getAllUniqueTags(this.env.DB);

          const totalArticles = recentArticles.length;
          const lastUpdated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

          let companies: Company[] = [];
          try {
            companies = await getTrackedCompanies(this.env.DB);
          } catch {
            // Use empty array if fetch fails
          }

          let summaries: InsightSummary[] = [];
          try {
            summaries = await getAllRecentSummaries(this.env.DB);
          } catch (err) {
            console.error('Failed to fetch summaries:', err);
          }

          const pages = generateAllPages(recentArticles, featuredArticles, tags, {
            sources: collection.sourceCount,
            articles: totalArticles,
            lastUpdated,
          }, summaries, companies);

          const rssFeed = generateRssFeed(recentArticles.slice(0, 50));
          pages['/feed.xml'] = rssFeed;

          // Write pages to KV in batches of 25
          const entries = Object.entries(pages);
          for (let i = 0; i < entries.length; i += 25) {
            const batch = entries.slice(i, i + 25);
            await Promise.all(batch.map(([path, html]) => this.env.KV.put(path, html)));
          }
          console.log(`Wrote ${entries.length} pages to KV`);

          return { pagesWritten: entries.length };
        } catch (err) {
          console.error('Page generation failed:', err);
          return { pagesWritten: 0 };
        }
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(
      `Pipeline workflow completed in ${elapsed}ms. ` +
      `Collected: ${collection.collected}, New: ${collection.new}, Scored: ${collection.scored}, ` +
      `Inserted: ${collection.inserted}, Backfilled: ${backfill.backfilled}, ` +
      `Companies matched: ${companyTracking.matched}, Insights: ${insights.generated}, ` +
      `Pages: ${rendering.pagesWritten}`
    );
  }
}
