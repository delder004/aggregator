export type SnapshotStatus = 'running' | 'complete' | 'error';

export interface SnapshotBase {
  id: string;
  windowStart: string;
  windowEnd: string;
  status: SnapshotStatus;
  attemptCount: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  blobKey: string | null;
}

export interface CfAnalyticsSnapshot extends SnapshotBase {
  source: 'graphql' | 'analytics_engine';
  totalRequests: number | null;
  /** Reserved for a future true pageview source; NULL in Phase 1. */
  totalPageViews: number | null;
  /** From sum.visits on httpRequestsAdaptiveGroups. NOT the same as pageviews. */
  totalVisits: number | null;
  uniqueVisitors: number | null;
  cachedPercentage: number | null;
  topPathsCount: number | null;
  topReferrersCount: number | null;
  topCountriesCount: number | null;
}

export interface SearchConsoleSnapshot extends SnapshotBase {
  totalImpressions: number | null;
  totalClicks: number | null;
  avgCtr: number | null;
  avgPosition: number | null;
  queriesCount: number | null;
  pagesCount: number | null;
}

export interface CompetitorSnapshot extends SnapshotBase {
  competitorSlug: string;
  itemsCount: number | null;
  homepageHtmlHash: string | null;
}

export interface KeywordRanking {
  id: string;
  keyword: string;
  checkedAt: string;
  windowStart: string;
  rank: number | null;
  urlRanked: string | null;
  serpFeatures: string[];
  totalResults: number | null;
}

export interface ArticleViewRow {
  articleId: string;
  viewDate: string;
  views: number;
  uniqueVisitors: number;
  topReferrer: string | null;
  updatedAt: string;
}

export type SourceCandidateOrigin =
  | 'novel_entity'
  | 'competitor'
  | 'web_search'
  | 'manual';

export type SourceCandidateStatus = 'new' | 'approved' | 'rejected' | 'shipped';

export interface SourceCandidate {
  id: string;
  name: string;
  url: string;
  sourceTypeGuess: string | null;
  rationale: string | null;
  origin: SourceCandidateOrigin;
  status: SourceCandidateStatus;
  firstSeenAt: string;
  updatedAt: string;
  promotedToSourceId: string | null;
}

export type IngestNamespace =
  | 'cf-analytics'
  | 'search-console'
  | 'rankings'
  | 'competitors'
  | 'article-views-rollup';

export type IngestRunStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';

export interface IngestRun {
  id: string;
  pipelineRunId: string;
  namespace: IngestNamespace;
  windowStart: string;
  windowEnd: string;
  status: IngestRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  errorMessage: string | null;
  metrics: Record<string, string | number | boolean | null>;
}

export interface IngestNamespaceStatus {
  namespace: IngestNamespace;
  windowStart: string | null;
  windowEnd: string | null;
  status: IngestRunStatus | 'never';
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
  metrics: Record<string, string | number | boolean | null>;
}
