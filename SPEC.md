# agenticaiaccounting.com — MVP Spec

## Overview

A fully automated, static news aggregator that collects content about **agentic AI in accounting** from across the internet, scores it for relevance using AI, and serves a clean read-only feed. Regenerated hourly.

---

## Architecture

```
Hourly Cron Trigger
        │
        ▼
┌──────────────────┐     ┌──────────────┐     ┌────────────┐
│   Collectors      │────▶│  AI Scoring  │────▶│  Database   │
│  RSS, APIs, etc.  │     │  (Claude API) │     │  (D1/SQLite)│
└──────────────────┘     └──────────────┘     └─────┬──────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  Static HTML│
                                              │  Generation │
                                              └─────┬──────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  Cloudflare │
                                              │  Pages/KV   │
                                              └────────────┘
```

### Stack

| Component         | Technology                          | Why                                    |
|-------------------|-------------------------------------|----------------------------------------|
| Runtime           | Cloudflare Worker (cron trigger)    | Built-in scheduling, edge performance  |
| Database          | Cloudflare D1 (SQLite)              | Free tier, no infra to manage          |
| AI Scoring        | Claude API (Haiku)                  | Fast, cheap, accurate classification   |
| Frontend          | Static HTML served from Worker      | Fast, cacheable, zero JS required      |
| Cache             | Cloudflare KV                       | Cache rendered HTML between cron runs  |
| Deployment        | Wrangler CLI                        | Single `wrangler deploy`               |

### How It Works

1. **Cron trigger** fires every hour on the Cloudflare Worker
2. **Collectors** fetch new content from all configured sources
3. **Deduplication** by URL — skip anything already in D1
4. **AI scoring** — Claude Haiku classifies relevance (0-100) and generates tags + summary
5. **Store** scored articles in D1
6. **Generate** static HTML from top articles, store in KV
7. **Serve** — HTTP requests hit the Worker, which returns cached HTML from KV

The site is effectively static: HTML is pre-rendered and cached. It just happens to live inside a Worker rather than a Pages deploy.

---

## Content Sources — Seed Data

This is the definitive list of sources for `src/db/seed.ts`. Each entry becomes a row in the `sources` table.

### RSS Feeds

| Name | URL | Status | Notes |
|------|-----|--------|-------|
| Accounting Today | `https://www.accountingtoday.com/feed` | Verified | Main industry feed |
| Journal of Accountancy | `https://www.journalofaccountancy.com/news.xml` | Needs verification | Try `/news.xml`; podcast at `jofacc.libsyn.com/rss` |
| Going Concern | `https://www.goingconcern.com/feed/` | Verified | WordPress `/feed/` pattern |
| CPA Practice Advisor | `https://www.cpapracticeadvisor.com/feed` | Needs verification | Try `/feed` or `/rss` |
| AccountingWeb | `https://www.accountingweb.co.uk/rss` | Verified | UK-centric but covers AI topics globally |
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` | Verified | WordPress category feed |
| VentureBeat AI | `https://venturebeat.com/category/ai/feed/` | Verified | |
| Import AI | `https://importai.substack.com/feed` | Verified | Jack Clark's newsletter, Substack |
| Jason Staats Newsletter | `https://newsletter.jason.cpa/feed` | Verified | Substack `/feed` pattern |
| Jason On Firms Podcast | `https://feeds.transistor.fm/jason-daily` | Verified | Transistor.fm |
| The Accounting Podcast | `https://feeds.transistor.fm/cloud-accounting-podcast` | Verified | Blake Oliver & David Leary |
| Earmark Podcast | `https://feeds.transistor.fm/earmark-accounting-podcast` | Verified | Blake Oliver |

**Omitted from MVP** (no usable RSS feed found):
- The Batch (deeplearning.ai) — email-only newsletter, no native RSS. Post-MVP: use kill-the-newsletter.com to convert.
- Big 4 AI blogs (Deloitte, PwC, EY, KPMG) — none offer AI-specific RSS feeds. Post-MVP: use a scraping service or third-party RSS generator.
- Rightworks blog — likely at `rightworks.com/blog/rss.xml` (HubSpot pattern) but unverified.
- Earmark CPE blog — likely at `earmarkcpe.com/feed` or `/blog/feed` but unverified.

### Reddit

All confirmed active. Use JSON API (`reddit.com/r/{sub}/search.json`).

| Subreddit | Members | Search queries |
|-----------|---------|---------------|
| r/accounting | ~368K | `"AI" OR "automation" OR "agentic"` |
| r/artificial | ~1.2M | `"accounting" OR "audit" OR "bookkeeping" OR "finance"` |
| r/MachineLearning | ~3.0M | `"accounting" OR "audit" OR "financial"` |
| r/fintech | active | `"AI" OR "agentic" OR "automation"` |
| r/Bookkeeping | active | `"AI" OR "automation" OR "agent"` |
| r/taxpros | active | `"AI" OR "automation" OR "agentic"` |

### Hacker News

Use Algolia HN Search API: `https://hn.algolia.com/api/v1/search`

Search queries (run each, deduplicate by URL):
- `"AI accounting"`
- `"agentic AI finance"`
- `"AI audit"`
- `"AI bookkeeping"`
- `"AI tax automation"`

### YouTube

Use YouTube Data API v3. Priority channels need their UC IDs resolved at build time (use the channels API with `forHandle` parameter).

| Channel | Handle | Channel ID | Notes |
|---------|--------|-----------|-------|
| Jason Staats | @jasoncpa | Resolve at build time | Main channel |
| Jason CPA Daily | @JasonCPADaily | Resolve at build time | Daily clips |
| Hector Garcia CPA | @HectorGarciaCPA | `UC00MExfC3vuP9680IUW0jLA` | Verified |
| The Accounting Podcast | @TheAccountingPodcast | Resolve at build time | Blake Oliver |

Search queries: `"AI accounting"`, `"agentic AI finance"`, `"AI audit automation"`

> **Note on channel ID resolution:** For handles without known UC IDs, the seed script should call the YouTube Channels API with `forHandle=@jasoncpa` to resolve the ID at setup time, or the YouTube collector can search by handle at runtime.

### arXiv

Use arXiv API: `https://export.arxiv.org/api/query`

Search query: `cat:cs.AI AND (all:accounting OR all:audit OR all:bookkeeping OR all:financial+reporting)`

Rate limit: 3-second delay between requests.

### Out of MVP

- **Twitter/X** — $100/mo API cost, deferred
- **LinkedIn** — no viable API access
- **Press releases** — nice-to-have, deferred

---

## Data Model

### Article

```sql
CREATE TABLE articles (
    id TEXT PRIMARY KEY,           -- UUID
    url TEXT UNIQUE NOT NULL,      -- canonical URL (dedup key)
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,     -- rss, reddit, hn, twitter, youtube, arxiv, press
    source_name TEXT NOT NULL,     -- "Accounting Today", "r/accounting", etc.
    author TEXT,
    published_at TEXT NOT NULL,    -- ISO 8601
    fetched_at TEXT NOT NULL,      -- ISO 8601
    content_snippet TEXT,          -- first ~500 chars of content
    image_url TEXT,                -- thumbnail/og:image
    relevance_score INTEGER,       -- 0-100, from Claude
    ai_summary TEXT,               -- 1-2 sentence summary from Claude
    tags TEXT,                     -- JSON array: ["audit", "automation", "tax"]
    is_published INTEGER DEFAULT 1 -- 1 = visible on site, 0 = filtered out
);

CREATE INDEX idx_published_at ON articles(published_at DESC);
CREATE INDEX idx_relevance ON articles(relevance_score DESC);
CREATE INDEX idx_source_type ON articles(source_type);
```

### Source Config

```sql
CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,     -- rss, reddit, hn, twitter, youtube, arxiv, press
    name TEXT NOT NULL,
    config TEXT NOT NULL,          -- JSON: url, subreddit, query, channel_id, etc.
    is_active INTEGER DEFAULT 1,
    last_fetched_at TEXT,
    error_count INTEGER DEFAULT 0
);
```

---

## AI Scoring Pipeline

Each new article is sent to **Claude Haiku** with this prompt structure:

```
You are a content classifier for a news site about agentic AI in accounting.

Score this article's relevance from 0-100:
- 90-100: Directly about AI agents in accounting/bookkeeping/audit/tax
- 70-89: About AI in finance/accounting broadly
- 50-69: About agentic AI generally (applicable to accounting)
- 30-49: About AI or accounting separately, tangentially related
- 0-29: Not relevant

Also provide:
- tags: up to 5 from [audit, tax, bookkeeping, compliance, payroll, invoicing,
  fraud-detection, financial-reporting, agentic-ai, llm, automation, startup,
  big-4, regulation, case-study, opinion, research]
- summary: 1-2 sentences for the feed

Article:
Title: {title}
Source: {source}
Content: {snippet}
```

**Expected output format** — The Claude API call must request JSON output. The classifier should parse this schema:

```json
{
  "relevanceScore": 72,
  "tags": ["agentic-ai", "automation", "big-4"],
  "summary": "Deloitte announces a new AI agent platform for automating audit workflows across mid-market clients."
}
```

The API call should use `"tool_use"` or instruct the model to respond with raw JSON. The classifier must validate:
- `relevanceScore` is an integer 0-100 (clamp if out of range)
- `tags` is an array of strings, each from the allowed set (discard unknown tags)
- `summary` is a non-empty string under 280 characters

**Threshold**: Only articles scoring **40+** get published to the feed. Articles scoring 70+ get featured placement.

**Cost estimate**: ~500 articles/day × ~200 tokens/article = ~100K tokens/day. At Haiku pricing, this is roughly **$0.03/day**.

---

## Environment Variables

All secrets are stored in Cloudflare via `wrangler secret put` or in `.dev.vars` for local development. Never commit secrets.

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `CLAUDE_API_KEY` | Yes | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| `REDDIT_CLIENT_ID` | Yes | [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → create "script" app |
| `REDDIT_CLIENT_SECRET` | Yes | Same as above |
| `YOUTUBE_API_KEY` | Yes | [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → YouTube Data API v3 |

**Local development** — create `.dev.vars` in the project root (already in `.gitignore`):

```
CLAUDE_API_KEY=sk-ant-...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
YOUTUBE_API_KEY=...
```

**Production** — set each via Wrangler:

```bash
npx wrangler secret put CLAUDE_API_KEY
npx wrangler secret put REDDIT_CLIENT_ID
npx wrangler secret put REDDIT_CLIENT_SECRET
npx wrangler secret put YOUTUBE_API_KEY
```

---

## Frontend

### Homepage (/)

Clean, fast, minimal. No JavaScript required for core functionality.

```
┌─────────────────────────────────────────────┐
│  🤖 Agentic AI Accounting                   │
│  The latest on AI agents in accounting       │
│                                              │
│  [All] [Audit] [Tax] [Automation] [Startups] │ ← tag filters (static pages)
├─────────────────────────────────────────────┤
│                                              │
│  ★ Featured Stories                          │
│  ┌─────────────────────────────────────┐    │
│  │ Title of high-relevance article      │    │
│  │ Source • 2 hours ago                 │    │
│  │ AI-generated summary text here...    │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Latest                                      │
│  ┌─────────┐ Title                           │
│  │  thumb   │ Source • 3 hours ago            │
│  │         │ Summary text...                 │
│  └─────────┘                                 │
│                                              │
│  ┌─────────┐ Title                           │
│  │  thumb   │ Source • 5 hours ago            │
│  └─────────┘                                 │
│                                              │
│  [Load more →]  (links to /page/2)           │
│                                              │
├─────────────────────────────────────────────┤
│  RSS Feed • About • Built with Claude        │
└─────────────────────────────────────────────┘
```

### Design Principles
- Minimal, professional, fast-loading
- Dark/light mode via `prefers-color-scheme`
- Mobile-first responsive
- No client-side JS for core reading experience
- Inline CSS (no external stylesheet requests)
- Total page weight target: < 50KB

### Pages
| Route            | Description                              |
|------------------|------------------------------------------|
| `/`              | Homepage — featured + latest articles     |
| `/page/{n}`      | Paginated feed (20 articles per page)     |
| `/tag/{tag}`     | Filtered by tag                           |
| `/feed.xml`      | RSS feed output                           |
| `/about`         | Simple about page                         |

All pages are **pre-rendered HTML stored in KV**. Tag pages and pagination are generated at build time.

---

## Hourly Cron Job Flow

```
1. For each active source:
   a. Fetch new content (respect rate limits)
   b. Normalize to Article schema
   c. Check URL against D1 — skip duplicates
   d. Batch new articles

2. Send new articles to Claude Haiku for scoring
   - Batch where possible to reduce API calls
   - Store scores, tags, summaries in D1

3. Regenerate static HTML:
   a. Query D1 for top articles (last 30 days, score >= 40)
   b. Render homepage, pagination pages, tag pages
   c. Render RSS feed
   d. Write all to KV

4. Log run stats (articles fetched, scored, published)
```

---

## Rate Limits & Quotas

| Source     | Limit                              | Strategy                        |
|------------|------------------------------------|---------------------------------|
| RSS        | None (polite crawling)             | Respect `Cache-Control`, 1 req/s |
| Reddit     | 60 req/min (with OAuth)            | Batch subreddit queries          |
| HN         | Algolia: 10K req/hr                | Single search query/hour         |
| Twitter/X  | Varies by tier (Basic: 10K/mo)     | Keyword search 1x/hour          |
| YouTube    | 10K units/day                      | Search: 100 units, so ~100/day   |
| arXiv      | No hard limit                      | 1 query/hour, polite delay       |
| Claude API | Based on plan                      | ~500 calls/day, well within tier |

---

## Cost Estimate (Monthly)

| Item                        | Cost       |
|-----------------------------|------------|
| Cloudflare Workers (paid)   | $5/mo      |
| Cloudflare D1               | Free tier  |
| Cloudflare KV               | Free tier  |
| Claude API (Haiku)          | ~$1/mo     |
| Twitter/X Basic API         | $100/mo    |
| YouTube Data API            | Free       |
| Domain                      | ~$10/yr    |
| **Total**                   | **~$6/mo** |

> **Note:** Twitter/X API is expensive ($100/mo for Basic). For MVP, consider skipping Twitter or using an RSS bridge service to monitor specific accounts. This brings the total to **~$6/mo**.

---

## MVP Scope — What's In / What's Out

### In (MVP)
- [ ] Cloudflare Worker with cron trigger
- [ ] RSS feed collector (5-10 key feeds)
- [ ] Reddit collector (3-4 subreddits)
- [ ] Hacker News collector (Algolia search)
- [ ] YouTube collector (search API)
- [ ] arXiv collector (API search)
- [ ] Claude Haiku scoring pipeline
- [ ] D1 database with article storage
- [ ] Static HTML homepage with featured + latest
- [ ] Pagination
- [ ] Tag filter pages
- [ ] RSS feed output (`/feed.xml`)
- [ ] Mobile-responsive design
- [ ] Dark/light mode

### In (MVP) — SEO essentials
- [ ] Open Graph / Twitter Card meta tags (critical for link sharing)
- [ ] Sitemap.xml (critical for Google indexing)
- [ ] Semantic HTML (article, time, h1-h3) for rich snippets

### Out (Post-MVP)
- [ ] Twitter/X integration (cost prohibitive for MVP)
- [ ] LinkedIn integration (API access issues)
- [ ] Press release monitoring (nice-to-have)
- [ ] Email newsletter / digest
- [ ] Search functionality
- [ ] User accounts / saved articles
- [ ] Comments / discussion
- [ ] Analytics dashboard
- [ ] Admin panel for source management
- [ ] Trending topics / weekly summary
- [ ] Manual article curation / moderation panel

---

## Project Structure

```
aggregator/
├── wrangler.toml              # Cloudflare Worker config
├── src/
│   ├── index.ts               # Worker entry point (HTTP + cron)
│   ├── collectors/
│   │   ├── rss.ts             # RSS feed fetcher
│   │   ├── reddit.ts          # Reddit API client
│   │   ├── hackernews.ts      # HN Algolia search
│   │   ├── youtube.ts         # YouTube Data API
│   │   └── arxiv.ts           # arXiv API
│   ├── scoring/
│   │   └── classifier.ts      # Claude Haiku scoring
│   ├── db/
│   │   ├── schema.sql         # D1 table definitions
│   │   └── queries.ts         # Database operations
│   ├── renderer/
│   │   ├── html.ts            # HTML template engine
│   │   ├── pages.ts           # Page generators
│   │   └── rss.ts             # RSS XML generator
│   └── utils/
│       ├── normalize.ts       # Article normalization
│       └── dedup.ts           # URL deduplication
├── static/
│   └── favicon.ico
├── pyproject.toml             # Python tooling (scripts, local dev)
└── SPEC.md                    # This file
```

> **Note:** The Worker is TypeScript since Cloudflare Workers has first-class TS support. The Python project can be used for local development scripts, data exploration, and one-off tasks like backfilling sources.

---

## Implementation Plan (Agent-Parallelized)

Work is broken into phases with explicit dependencies. Within each phase, all work items are **fully independent** and should be run as parallel agents in isolated worktrees, then merged.

### Shared Contract: `src/types.ts`

All agents depend on this file. It must be created **before** any parallel work begins.

```typescript
// -- Core types every module imports --

export interface Article {
  id: string;                   // UUID
  url: string;                  // canonical URL (dedup key)
  title: string;
  sourceType: SourceType;
  sourceName: string;
  author: string | null;
  publishedAt: string;          // ISO 8601
  fetchedAt: string;            // ISO 8601
  contentSnippet: string | null;// first ~500 chars
  imageUrl: string | null;      // thumbnail / og:image
  relevanceScore: number | null;// 0-100, from Claude
  aiSummary: string | null;     // 1-2 sentence summary
  tags: string[];               // e.g. ["audit", "automation"]
  isPublished: boolean;
}

export type SourceType = 'rss' | 'reddit' | 'hn' | 'youtube' | 'arxiv';

export interface SourceConfig {
  id: string;
  sourceType: SourceType;
  name: string;
  config: Record<string, string>;  // url, subreddit, query, channelId, etc.
  isActive: boolean;
  lastFetchedAt: string | null;
  errorCount: number;
}

// What every collector returns
export interface CollectedArticle {
  url: string;
  title: string;
  sourceType: SourceType;
  sourceName: string;
  author: string | null;
  publishedAt: string;
  contentSnippet: string | null;
  imageUrl: string | null;
}

// What the scorer returns
export interface ScoredArticle extends CollectedArticle {
  relevanceScore: number;
  aiSummary: string;
  tags: string[];
}

// Collector interface — every collector implements this
export interface Collector {
  collect(config: SourceConfig): Promise<CollectedArticle[]>;
}

// Environment bindings for Cloudflare Worker
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  CLAUDE_API_KEY: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  YOUTUBE_API_KEY?: string;
}
```

---

### Phase 0: Scaffold (sequential, single agent)

> **Must complete before any parallel work.**

Creates the project skeleton, shared types, wrangler config, DB schema, test infrastructure, and pre-commit hooks so parallel agents have a stable foundation to build on.

**Files to create:**
- `package.json` — dependencies: `wrangler`, `uuid`; devDependencies: `vitest`, `@cloudflare/vitest-pool-workers`, `husky`
- `tsconfig.json` — **must use `strict: true`** for maximum type safety across parallel agents
- `vitest.config.ts` — Vitest config using `@cloudflare/vitest-pool-workers`
- `wrangler.toml` — D1 binding, KV binding, cron trigger `0 * * * *`
- `src/types.ts` — shared types (see above)
- `src/db/schema.sql` — CREATE TABLE statements
- `src/db/queries.ts` — CRUD operations (insertArticle, getArticleByUrl, getPublishedArticles, updateSource, etc.)
- `src/index.ts` — stub entry point with fetch + scheduled handlers

**Post-scaffold setup:**
- Run `npx wrangler types` to generate `worker-configuration.d.ts` with actual D1/KV bindings. The `Env` interface in `src/types.ts` should extend or reference these generated types.
- Run `npx husky init` and configure `.husky/pre-commit` to run `npx tsc --noEmit` — this catches type errors before any commit lands, which is critical when 8 agents are committing independently.

**Acceptance:** `npx wrangler dev` starts without errors. `npx tsc --noEmit` passes. `npx vitest run` passes (even if no tests exist yet).

---

### Phase 1: Parallel Work (5 agents)

All agents work in **isolated worktrees**. Each agent gets:
- Read access to the Phase 0 scaffold (especially `src/types.ts` and `src/db/queries.ts`)
- Writes only to its designated files
- Must export functions matching the shared interfaces

#### Agent 1A: RSS Collector
- **File:** `src/collectors/rss.ts`
- **Task:** Implement RSS/Atom feed fetcher. Parse XML using built-in DOMParser (available in Workers). Extract title, link, pubDate, description, thumbnail. Return `CollectedArticle[]`.
- **Test sources:** Accounting Today RSS, Substack RSS (newsletter.jason.cpa)
- **Edge cases:** Atom vs RSS 2.0, missing fields, relative URLs, CDATA content

#### Agent 1B: Reddit Collector
- **File:** `src/collectors/reddit.ts`
- **Task:** Fetch from Reddit JSON API (`reddit.com/r/{sub}/search.json`). Use OAuth app-only flow for higher rate limits. Search each configured subreddit for AI + accounting keywords. Return `CollectedArticle[]`.
- **Subreddits:** r/accounting, r/artificial, r/MachineLearning, r/fintech
- **Edge cases:** Rate limiting (handle 429), selftext vs link posts, cross-posts

#### Agent 1C: Hacker News Collector
- **File:** `src/collectors/hackernews.ts`
- **Task:** Use Algolia HN Search API (`hn.algolia.com/api/v1/search`). Query for "AI accounting", "agentic AI finance", "AI audit", "AI bookkeeping". Filter by recency. Return `CollectedArticle[]`.
- **Edge cases:** Dedup across multiple query terms, Show HN detection, comment-only posts

#### Agent 1D: YouTube Collector
- **File:** `src/collectors/youtube.ts`
- **Task:** Use YouTube Data API v3. Search for relevant terms + monitor priority channel IDs (@jasoncpa, @JasonCPADaily). Extract title, thumbnail, description snippet, publishedAt. Return `CollectedArticle[]`.
- **Edge cases:** API quota management (track units used), shorts vs long-form, live streams

#### Agent 1E: arXiv Collector
- **File:** `src/collectors/arxiv.ts`
- **Task:** Use arXiv API (Atom feed at `export.arxiv.org/api/query`). Search cs.AI + finance/accounting terms. Extract title, authors, abstract (as contentSnippet), publishedAt. Return `CollectedArticle[]`.
- **Edge cases:** Rate limiting (3s between requests), multi-author formatting, abstract truncation

---

### Phase 2: Parallel Work (3 agents)

Depends on Phase 0 (types + DB). Does NOT depend on Phase 1 (collectors).

#### Agent 2A: AI Scoring Pipeline
- **File:** `src/scoring/classifier.ts`
- **Task:** Implement the Claude Haiku scoring function. Takes `CollectedArticle[]`, calls Claude API, returns `ScoredArticle[]`. Use the scoring prompt from the spec. Batch articles where possible (multiple articles per API call to reduce overhead). Handle API errors gracefully (retry once, then score as 0).
- **Important:** Use `fetch()` to call Claude API directly (no SDK needed in Workers).

#### Agent 2B: HTML Renderer
- **Files:** `src/renderer/html.ts`, `src/renderer/pages.ts`
- **Task:** Build a minimal HTML template engine (template literal functions, no library). Generate:
  - Homepage: featured articles (score >= 70) + latest articles, paginated (20/page)
  - Tag pages: `/tag/{tag}` filtered views
  - About page: static content
  - All pages include: OG meta tags, semantic HTML, inline CSS, dark/light mode via `prefers-color-scheme`, mobile-first responsive design
- **Design:** Minimal, professional. Total page weight < 50KB. No client-side JS for core reading. Pagination via `<a>` links.

#### Agent 2C: RSS Feed Generator
- **File:** `src/renderer/rss.ts`
- **Task:** Generate valid RSS 2.0 XML for `/feed.xml`. Include channel metadata (title, description, link, lastBuildDate). Each item: title, link, description (aiSummary), pubDate, guid, source, category tags. Validate against RSS 2.0 spec.

---

### Phase 3: Integration (sequential, single agent)

> Merges all parallel work and wires everything together.

#### Agent 3A: Wire Up & Deploy Config
- **File:** `src/index.ts` (rewrite from stub)
- **Task:**
  1. `scheduled()` handler: run all collectors → deduplicate → score → store in D1 → regenerate HTML → write to KV
  2. `fetch()` handler: route requests → serve HTML from KV → handle `/feed.xml`, `/tag/*`, `/page/*`, `/about`, `/sitemap.xml`
  3. Error handling: log failures per-source, don't let one source failure kill the whole run
  4. Generate `sitemap.xml` alongside other pages
- **Also:**
  - Populate `src/db/seed.ts` with initial source configs (all RSS feeds, subreddits, YT channels, etc. from the spec)
  - Verify `wrangler.toml` has all bindings and cron config
- **Acceptance:** `npx wrangler dev` runs the full pipeline locally. Homepage renders with test data.

---

### Phase 4: Polish & Deploy (sequential)

- Manual review of generated HTML (design, responsiveness)
- Test with real sources (dry run of cron job)
- `wrangler d1 execute` to create tables
- `wrangler deploy` to production
- Configure custom domain (agenticaiaccounting.com) in Cloudflare dashboard
- Verify cron trigger fires and populates feed

---

### Agent Coordination Rules

1. **Shared types are immutable during parallel phases.** If an agent needs a type change, it must note it as a TODO — the integration agent (Phase 3) resolves type conflicts.
2. **Each agent writes only to its designated files.** No cross-agent file edits.
3. **Agents must handle errors gracefully.** A collector that throws will break the whole cron job. Return empty arrays on failure, log the error.
4. **All agents should read SPEC.md** for context on the project, sources, scoring criteria, and design requirements.
5. **Use `isolation: "worktree"`** for all parallel agents to avoid merge conflicts.

---

## Decisions

1. **Branding**: Minimal for now — clean, professional defaults. Revisit post-MVP.
2. **Content age**: 30-day rolling window on the feed.
3. **Moderation**: Deferred — fully automated for MVP, manual curation later.

---

## Competitive Landscape

### Primary Competitor: Jason Staats

Jason Staats is the dominant voice in AI + accounting. Understanding his footprint is critical for SEO and content strategy.

| Property | Details |
|----------|---------|
| YouTube | [@jasoncpa](https://youtube.com/@jasoncpa), [@JasonCPADaily](https://youtube.com/@JasonCPADaily) |
| Podcast | "Jason On Firms Podcast" (Transistor, Apple, Spotify) — ~1,500 firm owners daily |
| Newsletter | ["What's Next For Accounting?"](https://newsletter.jason.cpa/) on Substack — weekly, 100+ issues |
| Website | [jason.cpa](https://jason.cpa/), [jasononfirms.com](https://jasononfirms.com/) |
| Community | Realize ([rlz.io](https://rlz.io/)) — 300+ firm alliance |
| Social | Twitter [@JStaatsCPA](https://x.com/jstaatscpa), LinkedIn [/in/jstaats](https://linkedin.com/in/jstaats/) |
| Topics | AI agents for firms, tech stack selection, CAS, pricing, automation workflows |

**How we differentiate**: Jason is a personality-driven content creator (opinions, advice, keynotes). We are a **comprehensive, real-time aggregator** — breadth and speed over personal brand. We surface *everything* happening in the space, including Jason's own content. We become the daily dashboard that even Jason would check.

**SEO strategy**: Target long-tail keywords he doesn't dominate:
- "agentic ai accounting news"
- "ai accounting automation news feed"
- "ai agents bookkeeping latest"
- "ai audit automation updates"
- Fresh, hourly content gives us a crawl-frequency advantage over his weekly newsletter.

### Other Key Players to Monitor (and aggregate from)

**Influencers:**
- **Blake Oliver & David Leary** — [The Accounting Podcast](https://accounting.show/) (#1 accounting podcast, strong AI/tech coverage)
- **Hector Garcia, CPA** — YouTube, QuickBooks + AI content
- **Donny Shimamoto, CPA** — Center for Accounting Transformation, Forbes Top 200 CPA
- **Roman Kepczyk, CPA** — Rightworks, Accounting Today Top 100

**Publications:**
- [Accounting Today](https://accountingtoday.com/) — major trade pub, annual AI survey
- [CPA Practice Advisor](https://cpapracticeadvisor.com/) — firm tech, AI tools, innovation awards
- [Journal of Accountancy](https://journalofaccountancy.com/) (AICPA) — AI adoption coverage
- [Rightworks blog](https://rightworks.com/blog/) — curated AI tools list
- [Earmark CPE](https://earmarkcpe.com/) — CPE content with AI focus

**Market context:** AI adoption among accounting firms jumped from 9% (2024) to 41% (2025). The global AI accounting market is projected at $10.87B in 2026, growing at 44.6% CAGR. Basis recently raised $100M for AI agents in accounting firms.
