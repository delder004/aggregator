/**
 * Source-diversity helpers for featured article selection.
 *
 * Ensures no single source dominates the featured section by capping
 * how many articles from the same `sourceName` can appear.
 */

import type { Article } from '../types';

/**
 * Select up to `total` articles from a pre-sorted list while allowing
 * at most `maxPerSource` articles from any single source.
 *
 * The input order (typically date-descending) is preserved in the output.
 *
 * @param articles     Articles already sorted in the desired display order.
 * @param maxPerSource Maximum number of articles allowed from one sourceName.
 * @param total        Maximum number of articles to return.
 */
export function diversifyFeatured(
  articles: Article[],
  maxPerSource: number,
  total: number,
): Article[] {
  const sourceCounts = new Map<string, number>();
  const result: Article[] = [];

  for (const article of articles) {
    if (result.length >= total) break;

    const count = sourceCounts.get(article.sourceName) ?? 0;
    if (count < maxPerSource) {
      result.push(article);
      sourceCounts.set(article.sourceName, count + 1);
    }
  }

  return result;
}
