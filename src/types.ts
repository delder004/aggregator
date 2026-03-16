// -- Core types every module imports --

export interface Article {
  id: string;
  url: string;
  title: string;
  sourceType: SourceType;
  sourceName: string;
  author: string | null;
  publishedAt: string;
  fetchedAt: string;
  contentSnippet: string | null;
  imageUrl: string | null;
  relevanceScore: number | null;
  qualityScore: number | null;
  socialScore: number | null;
  commentCount: number | null;
  companyMentions: string[];
  aiSummary: string | null;
  tags: string[];
  isPublished: boolean;
}

export type SourceType = 'rss' | 'reddit' | 'hn' | 'youtube' | 'arxiv' | 'substack' | 'producthunt' | 'ycombinator' | 'companyblog' | 'pressrelease';

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
}

export interface ScoredArticle extends CollectedArticle {
  relevanceScore: number;
  qualityScore?: number;
  companyMentions?: string[];
  aiSummary: string;
  tags: string[];
}

export interface Collector {
  collect(config: SourceConfig): Promise<CollectedArticle[]>;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  articleCount: number;
  lastMentionedAt: string | null;
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  CLAUDE_API_KEY: string;
  CRON_SECRET?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  YOUTUBE_API_KEY?: string;
}
