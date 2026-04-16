import type { Env } from '../types';
import type { WeeklyWindow } from '../analytics/window';
import type {
  CfAnalyticsSnapshot,
  KeywordRanking,
  SearchConsoleSnapshot,
  TopArticleByViews,
} from '../analytics/types';
import type { ConsolidationContext, ConsolidationInputRefs } from './types';
import { readBlob } from '../analytics/blob-store';
import {
  listCfAnalyticsSnapshots,
  listRecentKeywordRankings,
  listSearchConsoleSnapshots,
  listCompetitorSnapshots,
  listTopArticleViewsAggregated,
} from '../analytics/db';
import { listPipelineRuns } from '../db/queries';
import type { PipelineRun } from '../types';

/**
 * Per-family caps to keep the assembled context under ~15K tokens.
 * Each family is pre-aggregated to these limits before serialization.
 */
const CAPS = {
  maxPipelineRuns: 10,
  maxSearchConsoleQueries: 20,
  maxSearchConsolePages: 10,
  maxKeywords: 30,
  maxCompetitorItems: 10,
  maxCompetitors: 5,
  maxArticlesByViews: 20,
} as const;

/**
 * Rough token estimator: ~4 chars per token for English text.
 * Good enough for monitoring prompt growth; not used for hard limits.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface SearchConsoleBlob {
  topQueries?: Array<{
    key: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages?: Array<{
    key: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface CompetitorBlob {
  slug: string;
  name: string;
  bucket: string;
  items: Array<{ title: string; url: string | null }>;
}

/**
 * Assemble the full consolidation context from all six input families.
 *
 * Reads from D1 and KV, pre-aggregates each family to its cap, and
 * serializes into a single prompt string. Returns the prompt, a token
 * estimate, and refs to the input rows consumed (for traceability in
 * run_consolidations).
 *
 * Each family is wrapped in a labeled section header so the AI can
 * attribute its proposals to specific inputs.
 */
export async function assembleConsolidationContext(
  env: Env,
  window: WeeklyWindow
): Promise<ConsolidationContext> {
  const inputRefs: ConsolidationInputRefs = {
    pipelineRunIds: [],
    snapshotIds: {},
  };
  const sections: string[] = [];

  // 1. Pipeline run summaries (last 7 days)
  const runs = await listPipelineRuns(env.DB, CAPS.maxPipelineRuns);
  const recentRuns = runs.filter(
    (r) => r.startedAt >= window.windowStart && r.startedAt < window.windowEnd
  );
  inputRefs.pipelineRunIds = recentRuns.map((r) => r.id);
  sections.push(formatPipelineRuns(recentRuns));

  // 2. CF analytics (this window)
  const cfSnapshots = await listCfAnalyticsSnapshots(env.DB, 5);
  const cfSnapshot = cfSnapshots.find(
    (s) =>
      s.windowStart === window.windowStart &&
      s.status === 'complete'
  );
  if (cfSnapshot) {
    inputRefs.snapshotIds['cf-analytics'] = [cfSnapshot.id];
    sections.push(formatCfAnalytics(cfSnapshot));
  } else {
    sections.push('## Cloudflare Analytics\n\nNo data available for this window.');
  }

  // 3. Search Console (this window)
  const gscSnapshots = await listSearchConsoleSnapshots(env.DB, 5);
  const gscSnapshot = gscSnapshots.find(
    (s) =>
      s.windowStart === window.windowStart &&
      s.status === 'complete'
  );
  if (gscSnapshot) {
    inputRefs.snapshotIds['search-console'] = [gscSnapshot.id];
    let blob: SearchConsoleBlob | null = null;
    if (gscSnapshot.blobKey) {
      blob = await readBlob<SearchConsoleBlob>(env.KV, gscSnapshot.blobKey);
    }
    sections.push(formatSearchConsole(gscSnapshot, blob));
  } else {
    sections.push(
      '## Google Search Console\n\nNo data available for this window.'
    );
  }

  // 4. Rankings (current + previous window for deltas)
  const allRankings = await listRecentKeywordRankings(env.DB, 100);
  sections.push(formatRankings(allRankings, window));
  if (allRankings.length > 0) {
    inputRefs.snapshotIds['rankings'] = ['aggregated'];
  }

  // 5. Competitors (this window, direct bucket only)
  const compSnapshots = await listCompetitorSnapshots(env.DB, 50);
  const windowCompSnapshots = compSnapshots.filter(
    (s) =>
      s.windowStart === window.windowStart &&
      s.status === 'complete'
  );
  const compBlobs: CompetitorBlob[] = [];
  for (const snap of windowCompSnapshots) {
    if (snap.blobKey) {
      const blob = await readBlob<CompetitorBlob>(env.KV, snap.blobKey);
      if (blob && blob.bucket === 'direct') {
        compBlobs.push(blob);
      }
    }
  }
  if (windowCompSnapshots.length > 0) {
    inputRefs.snapshotIds['competitors'] = windowCompSnapshots.map((s) => s.id);
  }
  sections.push(formatCompetitors(compBlobs));

  // 6. Top articles by views
  const fromDate = window.windowStart.slice(0, 10);
  const toDate = window.windowEnd.slice(0, 10);
  const topArticles = await listTopArticleViewsAggregated(
    env.DB,
    fromDate,
    toDate,
    CAPS.maxArticlesByViews
  );
  sections.push(formatTopArticles(topArticles));

  const prompt = sections.join('\n\n---\n\n');
  const tokenEstimate = estimateTokens(prompt);

  return { prompt, tokenEstimate, inputRefs };
}

function formatPipelineRuns(runs: PipelineRun[]): string {
  const lines = ['## Pipeline Run Summaries', ''];
  if (runs.length === 0) {
    lines.push('No pipeline runs in this window.');
    return lines.join('\n');
  }
  lines.push(`${runs.length} runs in this window.`);
  for (const run of runs) {
    lines.push('');
    lines.push(`### Run ${run.id.slice(0, 8)}`);
    lines.push(`- Status: ${run.status}`);
    lines.push(`- Started: ${run.startedAt}`);
    lines.push(`- Collect: ${run.collectStatus}, Process: ${run.processStatus}`);
    if (run.retrospectiveSummary) {
      lines.push(`- Retrospective: ${run.retrospectiveSummary}`);
    }
    if (run.retrospectiveWentWell.length > 0) {
      lines.push(
        `- Went well: ${run.retrospectiveWentWell.join('; ')}`
      );
    }
    if (run.retrospectiveDidntGoWell.length > 0) {
      lines.push(
        `- Didn't go well: ${run.retrospectiveDidntGoWell.join('; ')}`
      );
    }
  }
  return lines.join('\n');
}

function formatCfAnalytics(snapshot: CfAnalyticsSnapshot): string {
  const lines = ['## Cloudflare Analytics', ''];
  lines.push(`- Window: ${snapshot.windowStart} to ${snapshot.windowEnd}`);
  lines.push(`- Total requests: ${snapshot.totalRequests ?? 'N/A'}`);
  lines.push(`- Page views: ${snapshot.totalPageViews ?? 'N/A'}`);
  lines.push(`- Unique visitors: ${snapshot.uniqueVisitors ?? 'N/A'}`);
  lines.push(
    `- Cached: ${snapshot.cachedPercentage !== null ? `${snapshot.cachedPercentage.toFixed(1)}%` : 'N/A'}`
  );
  return lines.join('\n');
}

function formatSearchConsole(
  snapshot: SearchConsoleSnapshot,
  blob: SearchConsoleBlob | null
): string {
  const lines = ['## Google Search Console', ''];
  lines.push(`- Window: ${snapshot.windowStart} to ${snapshot.windowEnd}`);
  lines.push(`- Total impressions: ${snapshot.totalImpressions ?? 0}`);
  lines.push(`- Total clicks: ${snapshot.totalClicks ?? 0}`);
  lines.push(
    `- Avg CTR: ${snapshot.avgCtr !== null ? `${(snapshot.avgCtr * 100).toFixed(2)}%` : 'N/A'}`
  );
  lines.push(
    `- Avg position: ${snapshot.avgPosition !== null ? snapshot.avgPosition.toFixed(1) : 'N/A'}`
  );

  if (blob?.topQueries && blob.topQueries.length > 0) {
    lines.push('');
    lines.push('### Top Queries (by impressions)');
    const queries = blob.topQueries.slice(0, CAPS.maxSearchConsoleQueries);
    for (const q of queries) {
      lines.push(
        `- "${q.key}": ${q.impressions} imp, ${q.clicks} clicks, CTR ${(q.ctr * 100).toFixed(1)}%, pos ${q.position.toFixed(1)}`
      );
    }
  }

  if (blob?.topPages && blob.topPages.length > 0) {
    lines.push('');
    lines.push('### Top Pages (by impressions)');
    const pages = blob.topPages.slice(0, CAPS.maxSearchConsolePages);
    for (const p of pages) {
      lines.push(
        `- ${p.key}: ${p.impressions} imp, ${p.clicks} clicks, pos ${p.position.toFixed(1)}`
      );
    }
  }

  return lines.join('\n');
}

function formatRankings(
  allRankings: KeywordRanking[],
  window: WeeklyWindow
): string {
  const lines = ['## Keyword Rankings', ''];

  // Group by keyword, then find current and previous week's rank
  const byKeyword = new Map<
    string,
    { current: KeywordRanking | null; previous: KeywordRanking | null }
  >();
  for (const r of allRankings) {
    const entry = byKeyword.get(r.keyword) ?? {
      current: null,
      previous: null,
    };
    if (r.windowStart === window.windowStart) {
      entry.current = r;
    } else if (!entry.previous || r.windowStart > entry.previous.windowStart) {
      entry.previous = r;
    }
    byKeyword.set(r.keyword, entry);
  }

  if (byKeyword.size === 0) {
    lines.push('No keyword ranking data available.');
    return lines.join('\n');
  }

  lines.push(`${byKeyword.size} keywords tracked.`);
  lines.push('');

  for (const [keyword, { current, previous }] of byKeyword) {
    const currentRank = current?.rank;
    const previousRank = previous?.rank;

    let delta = '';
    if (currentRank !== null && currentRank !== undefined && previousRank !== null && previousRank !== undefined) {
      const diff = previousRank - currentRank; // positive = improved
      if (diff > 0) delta = ` (improved +${diff})`;
      else if (diff < 0) delta = ` (dropped ${diff})`;
      else delta = ' (unchanged)';
    }

    const rankStr =
      currentRank !== null && currentRank !== undefined
        ? `#${currentRank}${delta}`
        : 'not in top 10';

    const nearPageOne =
      currentRank !== null &&
      currentRank !== undefined &&
      currentRank >= 8 &&
      currentRank <= 12
        ? ' ⚡ near page 1'
        : '';

    lines.push(`- "${keyword}": ${rankStr}${nearPageOne}`);
  }

  return lines.join('\n');
}

function formatCompetitors(blobs: CompetitorBlob[]): string {
  const lines = ['## Competitor Content', ''];

  const limited = blobs.slice(0, CAPS.maxCompetitors);
  if (limited.length === 0) {
    lines.push('No competitor data available for this window.');
    return lines.join('\n');
  }

  for (const comp of limited) {
    lines.push(`### ${comp.name}`);
    const items = comp.items.slice(0, CAPS.maxCompetitorItems);
    if (items.length === 0) {
      lines.push('- No items found');
    } else {
      for (const item of items) {
        const url = item.url ? ` (${item.url})` : '';
        lines.push(`- ${item.title}${url}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatTopArticles(articles: TopArticleByViews[]): string {
  const lines = ['## Top Articles by Views', ''];

  if (articles.length === 0) {
    lines.push('No article view data available for this window.');
    return lines.join('\n');
  }

  lines.push(`${articles.length} articles with views this window.`);
  lines.push('');

  for (const a of articles) {
    const title = a.headline || a.title;
    const score = a.relevanceScore !== null ? `score=${a.relevanceScore}` : '';
    const tags = a.tags.length > 0 ? `tags=[${a.tags.join(', ')}]` : '';
    const meta = [score, tags].filter(Boolean).join(', ');

    // Flag mismatches for the AI to investigate
    let flag = '';
    if (
      a.relevanceScore !== null &&
      a.relevanceScore >= 80 &&
      a.totalViews <= 5
    ) {
      flag = ' ⚠️ high-score/low-views';
    } else if (
      (a.relevanceScore === null || a.relevanceScore < 50) &&
      a.totalViews >= 50
    ) {
      flag = ' ⚠️ low-score/high-views';
    }

    lines.push(`- ${title}: ${a.totalViews} views (${meta})${flag}`);
  }

  return lines.join('\n');
}
