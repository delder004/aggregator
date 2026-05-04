/**
 * Post-process /jobs* pages to inject JobPosting JSON-LD before </body>.
 *
 * This is a wrapper around `renderJobPostingsJsonLd` (from PR #21) that
 * works at the page-record level instead of inside `generateJobsPage`.
 * That keeps the integration as a single 1-line wrap in `generateAllPages`,
 * rather than 5 separate edits to /jobs* page builders.
 *
 * Integration in pages.ts:
 *
 *   import { injectJobPostingsIntoPages } from './jobs-jsonld-injector';
 *
 *   // Inside generateAllPages, replace:
 *   //   Object.assign(pages, generateJobsPage(companies ?? [], jobsMap, layoutOpts));
 *   // with:
 *   Object.assign(pages, injectJobPostingsIntoPages(
 *     generateJobsPage(companies ?? [], jobsMap, layoutOpts),
 *     companies ?? [],
 *     jobsMap,
 *   ));
 */

import type { Company, CompanyJob } from '../types';
import { renderJobPostingsJsonLd, type EnrichedJob } from './jobposting-schema';

/** Slugify exactly like generateJobsPage does, so we can reverse-map paths to filters. */
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * For each /jobs* page in the input, compute the matching subset of jobs
 * and inject the corresponding JobPosting JSON-LD just before </body>.
 *
 * Pages without a </body> tag are passed through unchanged (defensive — the
 * renderer always emits </body>, but this avoids accidental corruption if
 * an upstream change ever drops it).
 */
export function injectJobPostingsIntoPages(
  pages: Record<string, string>,
  companies: Company[],
  companyJobs: Map<string, CompanyJob[]>,
): Record<string, string> {
  const companyMap = new Map(companies.map(c => [c.id, c]));

  // Build the full enriched jobs list, mirroring generateJobsPage.
  const allJobs: EnrichedJob[] = [];
  for (const company of companies) {
    const jobs = companyJobs.get(company.id) ?? [];
    for (const job of jobs) {
      allJobs.push({ ...job, companyName: company.name, companyId: company.id });
    }
  }

  if (allJobs.length === 0) return pages;

  const result: Record<string, string> = { ...pages };

  for (const path of Object.keys(result)) {
    if (!path.startsWith('/jobs')) continue;

    let jobsForPage: EnrichedJob[];
    if (path === '/jobs' || /^\/jobs\/page\/\d+$/.test(path)) {
      // The main /jobs feed and its pagination — emit schema for all jobs.
      // Per-page subsetting would mismatch what's visible; one full schema
      // block per pagination route is the safer call for crawlers.
      jobsForPage = allJobs;
    } else if (path === '/jobs/remote') {
      jobsForPage = allJobs.filter(j => j.isRemote);
    } else if (path.startsWith('/jobs/dept/')) {
      const slug = path.slice('/jobs/dept/'.length);
      jobsForPage = allJobs.filter(j => slugify(j.department || '') === slug);
    } else if (path.startsWith('/jobs/location/')) {
      const slug = path.slice('/jobs/location/'.length);
      jobsForPage = allJobs.filter(j => slugify(j.location || '') === slug);
    } else if (path.startsWith('/jobs/company/')) {
      const slug = path.slice('/jobs/company/'.length);
      jobsForPage = allJobs.filter(j => slugify(j.companyId) === slug);
    } else {
      continue;
    }

    if (jobsForPage.length === 0) continue;

    const jsonLd = renderJobPostingsJsonLd(jobsForPage, companyMap);
    if (!jsonLd) continue;

    const html = result[path];
    if (!html.includes('</body>')) continue;
    result[path] = html.replace('</body>', `${jsonLd}\n</body>`);
  }

  return result;
}
