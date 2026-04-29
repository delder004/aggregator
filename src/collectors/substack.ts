import type { Collector, CollectedArticle, SourceConfig } from '../types';
import { rssCollector } from './rss';

/**
 * Substack newsletter collector.
 *
 * Delegates to the standard rssCollector since Substack feeds are RSS 2.0,
 * then overrides sourceType to 'substack'. Extends maxContentLength to 1000
 * to capture fuller content snippets from newsletter posts.
 */
export const substackCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    const feedUrl = config.config.url;
    if (!feedUrl) {
      console.error(`[Substack] No URL configured for source "${config.name}"`);
      return [];
    }

    try {
      // Extend maxContentLength for Substack feeds to 1000 chars instead of default 500
      const substackConfig = { ...config, config: { ...config.config, maxContentLength: '1000' } };
      const articles = await rssCollector.collect(substackConfig);
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
