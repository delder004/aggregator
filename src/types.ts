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

export interface ScoredArticle extends CollectedArticle {
  relevanceScore: number;
  qualityScore: number;
  aiSummary: string;
  headline: string;
  tags: string[];
  companyMentions: string[];
  transcriptSummary?: string;
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
  description: string | null;
  category: string | null;
  fundingStage: string | null;
  logoUrl: string | null;
  isActive: boolean;
  addedAt: string;
  lastMentionedAt: string | null;
  articleCount: number;
  jobsBoardType: string | null;
  jobsBoardToken: string | null;
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
  HEALTHCHECK_URL?: string;
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
