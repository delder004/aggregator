/**
 * Source-diversity helpers for article selection.
 *
 * Ensures no single source dominates the featured section or main feed
 * by capping how many articles from the same `sourceName` can appear.
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

/**
 * Diversify a chronological feed by limiting how many articles from
 * the same source can appear in each "window" of N articles.
 *
 * Walks through articles in order. Within each sliding window of
 * `windowSize` articles, at most `maxPerSource` articles from the
 * same sourceName are included. Excess articles are deferred and
 * appended at the end (so they're not lost, just deprioritized).
 */
export function diversifyFeed(
  articles: Article[],
  maxPerSource: number = 2,
  windowSize: number = 10,
): Article[] {
  const result: Article[] = [];
  const deferred: Article[] = [];

  for (const article of articles) {
    // Count how many from this source are in the recent window
    const windowStart = Math.max(0, result.length - windowSize);
    let sourceCount = 0;
    for (let i = windowStart; i < result.length; i++) {
      if (result[i].sourceName === article.sourceName) {
        sourceCount++;
      }
    }

    if (sourceCount < maxPerSource) {
      result.push(article);
    } else {
      deferred.push(article);
    }
  }

  // Append deferred articles at the end so they're not lost
  return result.concat(deferred);
}
