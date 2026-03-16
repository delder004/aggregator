import type { Collector, CollectedArticle, SourceConfig } from '../types';
import { rssCollector } from './rss';

/**
 * Company blog collector — a thin wrapper around the RSS collector.
 *
 * Fetches from a company's blog RSS feed and tags each article with
 * the company name it came from. The source config should include a
 * `company` field identifying which company's blog this is.
 *
 * Source type: 'rss' (reuses RSS parsing from the RSS collector)
 *
 * Config fields:
 *   - url: the RSS feed URL for the company blog
 *   - company: the company name (e.g., "Intuit", "Xero")
 */

export const companyBlogCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    try {
      const company = config.config['company'];
      if (!company) {
        console.error(
          `[CompanyBlog] No company configured for source "${config.name}". ` +
          'Set config.company to the company name.'
        );
        return [];
      }

      const feedUrl = config.config['url'];
      if (!feedUrl) {
        console.error(
          `[CompanyBlog] No URL configured for source "${config.name}"`
        );
        return [];
      }

      // Delegate to the RSS collector for parsing
      const articles = await rssCollector.collect(config);

      // Tag each article with the company name in the sourceName
      const taggedArticles = articles.map((article) => ({
        ...article,
        sourceName: `${company} Blog`,
        sourceType: 'rss' as const,
      }));

      console.log(
        `[CompanyBlog] Collected ${taggedArticles.length} articles from ${company} blog`
      );

      return taggedArticles;
    } catch (err) {
      console.error(
        `[CompanyBlog] Error collecting from "${config.name}":`,
        err
      );
      return [];
    }
  },
};
