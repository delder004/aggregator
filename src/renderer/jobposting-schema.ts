/**
 * JobPosting JSON-LD schema generation for the /jobs* pages.
 *
 * Each posting becomes its own <script type="application/ld+json"> block.
 * This makes the /jobs* pages eligible for Google for Jobs — a separate
 * search vertical with its own dedicated UI in Google Search results.
 *
 * Spec: https://developers.google.com/search/docs/appearance/structured-data/job-posting
 *
 * Notes:
 * - We set `directApply: false` because applicants are sent to the company's
 *   external careers page (job.url) rather than applying through us.
 * - We don't fabricate `validThrough` or `baseSalary` because we don't have
 *   reliable data for them; Google treats those as optional.
 * - `description` falls back to a generic value when the company has none.
 *
 * Integration:
 *   import { renderJobPostingsJsonLd } from './jobposting-schema';
 *
 *   // Inside generateJobsPage (src/renderer/pages.ts):
 *   const companyMap = new Map(companies.map(c => [c.id, c]));
 *   ...
 *   body += renderJobCards(allJobs);
 *   body += renderJobPostingsJsonLd(allJobs, companyMap);
 *   // Apply the same `body += renderJobPostingsJsonLd(...)` line to each
 *   // /jobs/{remote,dept,location,company} variant so all jobs surfaces emit
 *   // their JobPosting schemas.
 */

import type { Company, CompanyJob } from '../types';

/** A job enriched with its company's display info, as used in pages.ts. */
export type EnrichedJob = CompanyJob & {
  companyName: string;
  companyId: string;
};

/**
 * Render JSON-LD JobPosting schema for each job. Returns a string of one
 * `<script type="application/ld+json">` block per job, joined with newlines.
 * Append the result anywhere in the page body — script blocks are valid HTML
 * inside <body>.
 */
export function renderJobPostingsJsonLd(
  jobs: EnrichedJob[],
  companyMap: Map<string, Company>
): string {
  if (jobs.length === 0) return '';

  const blocks: string[] = [];
  for (const job of jobs) {
    const company = companyMap.get(job.companyId);

    const posting: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: company?.description
        ? `${job.title} at ${job.companyName}. ${company.description}`
        : `${job.title} at ${job.companyName}, building agentic AI for accounting, audit, tax, or bookkeeping.`,
      identifier: {
        '@type': 'PropertyValue',
        name: job.companyName,
        value: job.id,
      },
      hiringOrganization: {
        '@type': 'Organization',
        name: job.companyName,
        ...(company?.website ? { sameAs: company.website } : {}),
        ...(company?.logoUrl ? { logo: company.logoUrl } : {}),
      },
      url: job.url,
      directApply: false,
    };

    if (job.postedAt) {
      posting.datePosted = job.postedAt;
    }

    if (job.isRemote) {
      posting.jobLocationType = 'TELECOMMUTE';
      posting.applicantLocationRequirements = {
        '@type': 'Country',
        name: 'Anywhere',
      };
    } else if (job.location) {
      posting.jobLocation = {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location,
        },
      };
    }

    blocks.push(`<script type="application/ld+json">${JSON.stringify(posting)}</script>`);
  }

  return blocks.join('\n');
}
