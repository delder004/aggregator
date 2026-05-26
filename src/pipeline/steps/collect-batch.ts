/**
 * Pipeline step: fetch a batch of sources in parallel.
 *
 * One source = one collector call. Per-source failures are caught and
 * surfaced in failedSources; the batch never fails wholesale because of
 * one broken feed. sourceUpdates is what store-articles uses to mark
 * last_fetched_at / error_count on the sources table.
 */

import type {
  CollectedArticle,
  Env,
  SourceConfig,
} from '../../types';
import type { Collector } from '../../types';
import { rssCollector } from '../../collectors/rss';
import { hackerNewsCollector } from '../../collectors/hackernews';
import { createYouTubeCollector } from '../../collectors/youtube';
import { arxivCollector } from '../../collectors/arxiv';
import { substackCollector } from '../../collectors/substack';
import { productHuntCollector } from '../../collectors/producthunt';
import { ycombinatorCollector } from '../../collectors/ycombinator';
import { companyBlogCollector } from '../../collectors/companyblog';
import { pressReleaseCollector } from '../../collectors/pressrelease';
import { blogScraperCollector } from '../../collectors/blogscraper';
import type { StepOutcome } from '../step-runner';

export interface CollectBatchResult {
  articles: CollectedArticle[];
  sourceUpdates: Array<{
    id: string;
    lastFetchedAt?: string;
    errorCount: number;
  }>;
  failedSources: string[];
  sourceCount: number;
}

function getCollector(sourceType: string, env: Env): Collector | null {
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

export async function runCollectBatch(
  env: Env,
  batchSources: SourceConfig[],
  batchIndex: number
): Promise<StepOutcome<CollectBatchResult>> {
  const sourceUpdates: CollectBatchResult['sourceUpdates'] = [];
  const failedSources: string[] = [];

  const collectResults = await Promise.all(
    batchSources.map(async (source): Promise<CollectedArticle[]> => {
      const collector = getCollector(source.sourceType, env);
      if (!collector) {
        console.warn(`No collector for source type: ${source.sourceType}`);
        failedSources.push(source.name);
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
        failedSources.push(source.name);
        sourceUpdates.push({
          id: source.id,
          errorCount: source.errorCount + 1,
        });
        return [];
      }
    })
  );

  const articles = collectResults.flat();
  console.log(
    `Batch ${batchIndex}: collected ${articles.length} articles from ${batchSources.length} sources`
  );

  return {
    status: failedSources.length > 0 ? 'warning' : 'ok',
    metrics: {
      sources: batchSources.length,
      failedSources: failedSources.length,
      collectedArticles: articles.length,
    },
    notes:
      failedSources.length > 0
        ? [`Failed sources: ${failedSources.join(', ')}`]
        : [],
    result: {
      articles,
      sourceUpdates,
      failedSources,
      sourceCount: batchSources.length,
    },
  };
}
