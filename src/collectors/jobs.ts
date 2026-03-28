/**
 * Job board collector for company detail pages.
 *
 * Fetches open positions from Greenhouse, Lever, and Ashby APIs.
 * Each ATS returns structured JSON — no HTML scraping needed.
 */

import type { Company, CompanyJob, JobsBoardType } from '../types';

/** Max companies to scrape per cron run (to stay within subrequest budget). */
const MAX_COMPANIES_PER_RUN = 30;

/** KV key for tracking when jobs were last fetched. */
const JOBS_LAST_FETCHED_KEY = '__jobs_last_fetched__';

/** Minimum interval between job scrapes (23 hours). */
const MIN_FETCH_INTERVAL_MS = 23 * 60 * 60 * 1000;

interface RawJob {
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  postedAt: string | null;
  isRemote: boolean;
}

/** Detect whether a job is remote based on its location and title. */
function detectRemote(location: string | null, title: string): boolean {
  const text = `${location ?? ''} ${title}`.toLowerCase();
  return /\bremote\b/.test(text);
}

// ---------------------------------------------------------------------------
// ATS fetchers
// ---------------------------------------------------------------------------

async function fetchGreenhouseJobs(token: string): Promise<RawJob[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`
  );
  if (!res.ok) {
    console.error(`[Jobs] Greenhouse ${token}: HTTP ${res.status}`);
    return [];
  }

  const data = (await res.json()) as {
    jobs: Array<{
      title: string;
      departments: Array<{ name: string }>;
      location: { name: string };
      absolute_url: string;
      updated_at: string;
    }>;
  };

  return (data.jobs || []).map((j) => {
    const location = j.location?.name || null;
    return {
      title: j.title,
      department: j.departments?.[0]?.name || null,
      location,
      url: j.absolute_url,
      postedAt: j.updated_at || null,
      isRemote: detectRemote(location, j.title),
    };
  });
}

async function fetchLeverJobs(token: string): Promise<RawJob[]> {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${token}?mode=json`
  );
  if (!res.ok) {
    console.error(`[Jobs] Lever ${token}: HTTP ${res.status}`);
    return [];
  }

  const data = (await res.json()) as Array<{
    text: string;
    categories: { team?: string; location?: string; department?: string };
    hostedUrl: string;
    createdAt: number;
  }>;

  return (data || []).map((j) => {
    const location = j.categories?.location || null;
    return {
      title: j.text,
      department: j.categories?.team || j.categories?.department || null,
      location,
      url: j.hostedUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      isRemote: detectRemote(location, j.text),
    };
  });
}

async function fetchAshbyJobs(token: string): Promise<RawJob[]> {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${token}`
  );
  if (!res.ok) {
    console.error(`[Jobs] Ashby ${token}: HTTP ${res.status}`);
    return [];
  }

  const data = (await res.json()) as {
    jobs: Array<{
      title: string;
      department: string;
      location: string;
      jobUrl: string;
      publishedDate: string;
    }>;
  };

  return (data.jobs || []).map((j) => {
    const location = j.location || null;
    return {
      title: j.title,
      department: j.department || null,
      location,
      url: j.jobUrl,
      postedAt: j.publishedDate || null,
      isRemote: detectRemote(location, j.title),
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if enough time has passed since the last job scrape.
 */
export async function shouldFetchJobs(kv: KVNamespace): Promise<boolean> {
  const last = await kv.get(JOBS_LAST_FETCHED_KEY, 'text');
  if (!last) return true;
  const elapsed = Date.now() - new Date(last).getTime();
  return elapsed >= MIN_FETCH_INTERVAL_MS;
}

/**
 * Record that jobs were just fetched.
 */
export async function markJobsFetched(kv: KVNamespace): Promise<void> {
  await kv.put(JOBS_LAST_FETCHED_KEY, new Date().toISOString());
}

/**
 * Fetch jobs for a single company based on its ATS type.
 */
export async function fetchJobsForCompany(
  company: Company
): Promise<RawJob[]> {
  if (!company.jobsBoardType || !company.jobsBoardToken) return [];

  const type = company.jobsBoardType as JobsBoardType;
  const token = company.jobsBoardToken;

  try {
    switch (type) {
      case 'greenhouse':
        return await fetchGreenhouseJobs(token);
      case 'lever':
        return await fetchLeverJobs(token);
      case 'ashby':
        return await fetchAshbyJobs(token);
      default:
        return [];
    }
  } catch (err) {
    console.error(`[Jobs] Failed to fetch jobs for ${company.name}:`, err);
    return [];
  }
}

/**
 * Run the full job collection pipeline:
 * 1. Fetch jobs from each company's ATS
 * 2. Upsert into company_jobs table
 * 3. Remove stale jobs not seen in latest scrape
 */
export async function collectAllJobs(
  db: D1Database,
  companies: Company[]
): Promise<{ fetched: number; companies: number }> {
  const companiesWithBoards = companies.filter(
    (c) => c.jobsBoardType && c.jobsBoardToken
  );

  // Cap companies per run
  const toFetch = companiesWithBoards.slice(0, MAX_COMPANIES_PER_RUN);
  const now = new Date().toISOString();
  let totalFetched = 0;
  let companiesProcessed = 0;

  for (const company of toFetch) {
    const jobs = await fetchJobsForCompany(company);
    if (jobs.length === 0) {
      // Even if 0 jobs, clear stale entries
      try {
        await db
          .prepare('DELETE FROM company_jobs WHERE company_id = ?')
          .bind(company.id)
          .run();
      } catch (err) {
        console.error(`[Jobs] Cleanup failed for ${company.name}:`, err);
      }
      companiesProcessed++;
      continue;
    }

    // Upsert jobs in batches
    const stmts: D1PreparedStatement[] = [];
    for (const job of jobs) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO company_jobs (id, company_id, title, department, location, url, posted_at, last_seen_at, is_remote)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(url) DO UPDATE SET
               title = excluded.title,
               department = excluded.department,
               location = excluded.location,
               posted_at = COALESCE(excluded.posted_at, company_jobs.posted_at),
               last_seen_at = excluded.last_seen_at,
               is_remote = excluded.is_remote`
          )
          .bind(
            crypto.randomUUID(),
            company.id,
            job.title,
            job.department,
            job.location,
            job.url,
            job.postedAt,
            now,
            job.isRemote ? 1 : 0
          )
      );
    }

    // Delete jobs for this company that weren't in the latest scrape
    const jobUrls = jobs.map((j) => j.url);
    const placeholders = jobUrls.map(() => '?').join(',');
    stmts.push(
      db
        .prepare(
          `DELETE FROM company_jobs WHERE company_id = ? AND url NOT IN (${placeholders})`
        )
        .bind(company.id, ...jobUrls)
    );

    try {
      // Batch in chunks of 50 to stay within limits
      for (let i = 0; i < stmts.length; i += 50) {
        await db.batch(stmts.slice(i, i + 50));
      }
      totalFetched += jobs.length;
      companiesProcessed++;
      console.log(`[Jobs] ${company.name}: ${jobs.length} jobs`);
    } catch (err) {
      console.error(`[Jobs] DB write failed for ${company.name}:`, err);
    }
  }

  console.log(
    `[Jobs] Collected ${totalFetched} jobs from ${companiesProcessed} companies`
  );
  return { fetched: totalFetched, companies: companiesProcessed };
}

/**
 * Get all jobs grouped by company ID.
 */
export async function getAllCompanyJobs(
  db: D1Database
): Promise<Map<string, CompanyJob[]>> {
  try {
    const results = await db
      .prepare(
        'SELECT * FROM company_jobs ORDER BY company_id, department, title'
      )
      .all();

    const map = new Map<string, CompanyJob[]>();
    for (const row of results.results) {
      const job: CompanyJob = {
        id: row.id as string,
        companyId: row.company_id as string,
        title: row.title as string,
        department: (row.department as string) || null,
        location: (row.location as string) || null,
        url: row.url as string,
        postedAt: (row.posted_at as string) || null,
        lastSeenAt: row.last_seen_at as string,
        isRemote: row.is_remote === 1,
      };
      const existing = map.get(job.companyId) ?? [];
      existing.push(job);
      map.set(job.companyId, existing);
    }
    return map;
  } catch (err) {
    console.error('[Jobs] Failed to fetch all company jobs:', err);
    return new Map();
  }
}
