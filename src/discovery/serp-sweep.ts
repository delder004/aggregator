/**
 * SERP sweep step for source discovery.
 *
 * For each synthesized query, hit Serper, drop results that fail the theme
 * regex or are in the deny-list or are already-tracked sources, and tally
 * domain → set of queries that surfaced it. Returns one DomainHit per
 * unfamiliar domain seen at least once.
 *
 * The orchestrator then promotes domains seen in ≥ MIN_QUERY_COUNT distinct
 * queries to source_candidates.
 */

import type { Env } from '../types';
import { fetchSerperResults } from '../analytics/rankings';
import { extractRootDomain, isDenied, matchesTheme } from './theme';

export interface DomainHit {
  rootDomain: string;
  sampleUrl: string;
  sampleTitle: string;
  sampleSnippet: string;
  /** Distinct queries that surfaced this domain (deduped, lowercased keys). */
  queries: string[];
}

export interface SerpSweepResult {
  totalQueries: number;
  totalResults: number;
  filteredOffTheme: number;
  filteredDenied: number;
  filteredKnown: number;
  domains: DomainHit[];
  errors: string[];
}

export async function sweepQueries(
  env: Env,
  queries: string[],
  knownDomains: Set<string>
): Promise<SerpSweepResult> {
  if (!env.SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY required for SERP sweep');
  }

  const apiKey = env.SERPER_API_KEY;
  const result: SerpSweepResult = {
    totalQueries: queries.length,
    totalResults: 0,
    filteredOffTheme: 0,
    filteredDenied: 0,
    filteredKnown: 0,
    domains: [],
    errors: [],
  };

  const hitsByDomain = new Map<string, DomainHit>();

  for (const query of queries) {
    let parsed;
    try {
      parsed = await fetchSerperResults(apiKey, query);
    } catch (err) {
      result.errors.push(
        `${query}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const organic of parsed.organic) {
      if (!organic.link) continue;
      result.totalResults++;

      const domain = extractRootDomain(organic.link);
      if (!domain) continue;

      const titleSnippet = `${organic.title ?? ''} ${organic.snippet ?? ''}`;
      if (!matchesTheme(titleSnippet)) {
        result.filteredOffTheme++;
        continue;
      }
      if (isDenied(domain)) {
        result.filteredDenied++;
        continue;
      }
      if (knownDomains.has(domain)) {
        result.filteredKnown++;
        continue;
      }

      const existing = hitsByDomain.get(domain);
      if (existing) {
        if (!existing.queries.includes(query)) {
          existing.queries.push(query);
        }
      } else {
        hitsByDomain.set(domain, {
          rootDomain: domain,
          sampleUrl: organic.link,
          sampleTitle: organic.title ?? '',
          sampleSnippet: organic.snippet ?? '',
          queries: [query],
        });
      }
    }
  }

  result.domains = Array.from(hitsByDomain.values()).sort(
    (a, b) => b.queries.length - a.queries.length
  );
  return result;
}
