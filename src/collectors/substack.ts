import type { Collector, CollectedArticle, SourceConfig } from '../types';
import { rssCollector } from './rss';

/**
 * Substack newsletter collector.
 *
 * Delegates to the standard rssCollector since Substack feeds are RSS 2.0,
 * then overrides sourceType to 'substack'.
 */
export const substackCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    const feedUrl = config.config.url;
    if (!feedUrl) {
      console.error(`[Substack] No URL configured for source "${config.name}"`);
      return [];
    }

    try {
      const articles = await rssCollector.collect(config);
      for (const article of articles) {
        article.sourceType = 'substack';
      }
      console.log(`[Substack] Collected ${articles.length} articles from ${config.name} (${feedUrl})`);
      return articles;
    } catch (err) {
      console.error(`[Substack] Error collecting from ${config.name} (${feedUrl}):`, err);
      return [];
    }
  },
};
