/**
 * Pipeline step: discover new companies from recently-scored articles and
 * auto-create sources for their blogs.
 *
 * Uses the scoring step's websiteHints to skip the website-probe call
 * when the classifier already surfaced a homepage URL. Capped at
 * MAX_ENRICHMENTS_PER_RUN per cron to keep subrequests bounded.
 */

import type { Env } from '../../types';
import { getRecentlyScoredArticles } from '../../db/queries';
import {
  createDiscoveredCompany,
  discoverNewCompanies,
  getTrackedCompanies,
  insertSource,
} from '../../company/tracker';
import {
  MAX_ENRICHMENTS_PER_RUN,
  discoverBlog,
  probeJobBoards,
  probeWebsite,
} from '../../company/enricher';
import type { StepOutcome } from '../step-runner';

export interface CompanyEnrichmentResult {
  discovered: number;
  enriched: number;
  failed: number;
  failedCandidates?: string[];
  newCompanyIds: string[];
  skippedReason?: string;
  error?: string;
}

export async function companyEnrichmentStep(
  env: Env,
  watermark: string,
  websiteHints: Record<string, string>
): Promise<StepOutcome<CompanyEnrichmentResult>> {
  try {
    const companies = await getTrackedCompanies(env.DB);
    const recentlyScored = await getRecentlyScoredArticles(env.DB, watermark);

    if (recentlyScored.length === 0) {
      return {
        status: 'skipped',
        metrics: { discovered: 0, enriched: 0, failed: 0 },
        notes: ['No recently scored articles were available for company discovery.'],
        result: {
          discovered: 0,
          enriched: 0,
          failed: 0,
          newCompanyIds: [],
          skippedReason: 'No recently scored articles were available for company discovery.',
        },
      };
    }

    const candidates = discoverNewCompanies(
      recentlyScored,
      companies,
      websiteHints,
      MAX_ENRICHMENTS_PER_RUN
    );

    if (candidates.length === 0) {
      console.log('No new companies to discover');
      return {
        status: 'skipped',
        metrics: { discovered: 0, enriched: 0, failed: 0 },
        notes: ['No new company candidates were identified.'],
        result: {
          discovered: 0,
          enriched: 0,
          failed: 0,
          newCompanyIds: [],
          skippedReason: 'No new company candidates were identified.',
        },
      };
    }

    console.log(
      `[Enricher] Discovered ${candidates.length} new company candidates: ${candidates.map((c) => c.name).join(', ')}`
    );

    let enrichedCount = 0;
    const failedCandidates: string[] = [];
    const newCompanyIds: string[] = [];
    for (const candidate of candidates) {
      try {
        const website = await probeWebsite(candidate.name, candidate.website);
        const companyId = await createDiscoveredCompany(
          env.DB,
          candidate.name,
          website
        );
        newCompanyIds.push(companyId);

        if (website) {
          const blog = await discoverBlog(website);
          if (blog.type === 'rss' && blog.feedUrl) {
            await insertSource(
              env.DB,
              `auto-blog-${companyId}`,
              'companyblog',
              `${candidate.name} Blog`,
              { url: blog.feedUrl, company: candidate.name }
            );
            console.log(
              `[Enricher] Auto-created RSS source for ${candidate.name}: ${blog.feedUrl}`
            );
          } else if (blog.type === 'scraper' && blog.blogUrl) {
            await insertSource(
              env.DB,
              `auto-scrape-${companyId}`,
              'blogscraper',
              `${candidate.name} Blog`,
              {
                url: blog.blogUrl,
                articlePathPrefix: '/blog/',
                company: candidate.name,
              }
            );
            console.log(
              `[Enricher] Auto-created blog scraper for ${candidate.name}: ${blog.blogUrl}`
            );
          }
        }

        const jobBoard = await probeJobBoards(candidate.name);
        if (jobBoard) {
          await env.DB.prepare(
            'UPDATE companies SET jobs_board_type = ?, jobs_board_token = ? WHERE id = ?'
          )
            .bind(jobBoard.type, jobBoard.token, companyId)
            .run();
          console.log(
            `[Enricher] Found ${jobBoard.type} job board for ${candidate.name} (token: ${jobBoard.token})`
          );
        }

        enrichedCount++;
      } catch (err) {
        failedCandidates.push(candidate.name);
        console.error(`[Enricher] Failed to enrich ${candidate.name}:`, err);
      }
    }

    console.log(
      `[Enricher] Complete: ${candidates.length} discovered, ${enrichedCount} enriched`
    );

    const notes: string[] = [];
    if (failedCandidates.length > 0) {
      notes.push(`Failed candidates: ${failedCandidates.join(', ')}`);
    }

    return {
      status: failedCandidates.length > 0 ? 'warning' : 'ok',
      metrics: {
        discovered: candidates.length,
        enriched: enrichedCount,
        failed: failedCandidates.length,
      },
      notes,
      result: {
        discovered: candidates.length,
        enriched: enrichedCount,
        failed: failedCandidates.length,
        failedCandidates,
        newCompanyIds,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Company enrichment step failed:', err);
    return {
      status: 'error',
      metrics: { discovered: 0, enriched: 0, failed: 0 },
      errors: [message],
      result: {
        discovered: 0,
        enriched: 0,
        failed: 0,
        newCompanyIds: [],
        error: message,
      },
    };
  }
}
