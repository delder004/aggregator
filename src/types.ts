// -- Core types every module imports --

export interface Article {
  id: string;
  url: string;
  title: string;
  headline: string | null;
  sourceType: SourceType;
  sourceName: string;
  author: string | null;
  publishedAt: string;
  fetchedAt: string;
  contentSnippet: string | null;
  imageUrl: string | null;
  relevanceScore: number | null;
  qualityScore: number | null;
  aiSummary: string | null;
  tags: string[];
  isPublished: boolean;
  socialScore: number | null;
  commentCount: number | null;
  companyMentions: string[];
  transcript: string | null;
  transcriptSummary: string | null;
}

export type SourceType =
  | 'rss'
  | 'hn'
  | 'youtube'
  | 'arxiv'
  | 'substack'
  | 'producthunt'
  | 'ycombinator'
  | 'companyblog'
  | 'pressrelease'
  | 'blogscraper';

export interface SourceConfig {
  id: string;
  sourceType: SourceType;
  name: string;
  config: Record<string, string>;
  isActive: boolean;
  lastFetchedAt: string | null;
  errorCount: number;
}

export interface CollectedArticle {
  url: string;
  title: string;
  sourceType: SourceType;
  sourceName: string;
  author: string | null;
  publishedAt: string;
  contentSnippet: string | null;
  imageUrl: string | null;
  socialScore?: number;
  commentCount?: number;
  transcript?: string;
}

/** Enriched company mention from the classifier (transient, not stored in DB). */
export interface CompanyMention {
  name: string;
  website?: string;
}

export interface ScoredArticle extends CollectedArticle {
  relevanceScore: number;
  qualityScore: number;
  aiSummary: string;
  headline: string;
  tags: string[];
  companyMentions: string[];
  enrichedCompanyMentions?: CompanyMention[];
  transcriptSummary?: string;
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
  description: string | null;
  category: string | null;
  categorySlug: string | null;
  fundingStage: string | null;
  logoUrl: string | null;
  isActive: boolean;
  addedAt: string;
  lastMentionedAt: string | null;
  articleCount: number;
  jobsBoardType: string | null;
  jobsBoardToken: string | null;
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
}

export type JobsBoardType = 'greenhouse' | 'lever' | 'ashby';

export interface CompanyJob {
  id: string;
  companyId: string;
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  postedAt: string | null;
  lastSeenAt: string;
  isRemote: boolean;
}

export interface Collector {
  collect(config: SourceConfig): Promise<CollectedArticle[]>;
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  CLAUDE_API_KEY: string;
  CRON_SECRET?: string;
  YOUTUBE_API_KEY?: string;
  PRODUCTHUNT_API_TOKEN?: string;
  SUPADATA_API_KEY?: string;
  COLLECT_WORKFLOW: Workflow;
  PROCESS_WORKFLOW: Workflow;
  INGEST_WORKFLOW: Workflow;
  HEALTHCHECK_URL?: string;
  BUTTONDOWN_API_KEY?: string;
  // Phase 1 consolidation loop: capture-layer bindings & secrets
  AE_EVENTS?: AnalyticsEngineDataset;
  AE_ENGAGEMENT?: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_API_TOKEN?: string;
  CF_ZONE_ID?: string;
  GSC_CLIENT_ID?: string;
  GSC_CLIENT_SECRET?: string;
  GSC_REFRESH_TOKEN?: string;
  GSC_SITE_URL?: string;
  SERPER_API_KEY?: string;
  SITE_HOSTNAME?: string;
}

// -- Insights Summary types --

export type InsightPeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface InsightSummary {
  id: string;
  periodType: InsightPeriodType;
  periodStart: string;
  periodEnd: string;
  title: string;
  content: string;
  contentHtml: string;
  articleCount: number;
  topArticleIds: string[];
  generatedAt: string;
}

export interface CompanyInsight {
  id: string;
  companyId: string;
  content: string;
  contentHtml: string;
  articleCount: number;
  generatedAt: string;
}

// -- Pipeline run telemetry types --

export type RunTriggerType = 'scheduled' | 'manual';
export type RunWorkflowName = 'collect' | 'process';
export type RunStatus = 'running' | 'complete' | 'warning' | 'error';
export type RunWorkflowStatus = 'pending' | 'running' | 'complete' | 'warning' | 'error';
export type RunStepStatus = 'ok' | 'skipped' | 'warning' | 'error';
export type RunRetrospectiveStatus = 'pending' | 'generating' | 'complete' | 'failed';
export type RunMetricValue = string | number | boolean | null;

export interface RunWorkflowParams {
  pipelineRunId: string;
  triggerType: RunTriggerType;
  triggerSource: string;
  startedAt: string;
}

export interface RunStepReport {
  stepName: string;
  status: RunStepStatus;
  startedAt: string;
  completedAt: string;
  metrics?: Record<string, RunMetricValue>;
  notes?: string[];
  errors?: string[];
}

export interface PipelineRunRetrospective {
  summary: string;
  wentWell: string[];
  didntGoWell: string[];
  followUps: string[];
  generatedAt: string;
}

export interface PipelineRun {
  id: string;
  triggerType: RunTriggerType;
  triggerSource: string;
  startedAt: string;
  completedAt: string | null;
  status: RunStatus;
  collectWorkflowId: string | null;
  collectStartedAt: string | null;
  collectCompletedAt: string | null;
  collectStatus: RunWorkflowStatus;
  processWorkflowId: string | null;
  processStartedAt: string | null;
  processCompletedAt: string | null;
  processStatus: RunWorkflowStatus;
  retrospectiveStatus: RunRetrospectiveStatus;
  retrospectiveSummary: string | null;
  retrospectiveWentWell: string[];
  retrospectiveDidntGoWell: string[];
  retrospectiveFollowUps: string[];
  retrospectiveGeneratedAt: string | null;
  retrospectiveError: string | null;
}

export interface PipelineRunStep {
  pipelineRunId: string;
  workflowName: RunWorkflowName;
  stepName: string;
  status: RunStepStatus;
  startedAt: string;
  completedAt: string;
  metrics: Record<string, RunMetricValue>;
  notes: string[];
  errors: string[];
}
