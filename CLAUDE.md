# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agenticaiaccounting.com** — a fully automated news aggregator for agentic AI in accounting. Cloudflare Worker collects content hourly from RSS, Reddit, HN, YouTube, and arXiv, scores relevance with Claude Haiku, and serves pre-rendered static HTML.

See `SPEC.md` for the full product spec, competitive landscape, data model, scoring criteria, and content sources.

## Stack

- **Runtime:** Cloudflare Worker (TypeScript) with cron trigger
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV (pre-rendered HTML pages)
- **AI:** Claude API (Haiku) for relevance scoring
- **Deploy:** Wrangler CLI

## Commands

```bash
npm install                          # install dependencies
npx wrangler dev                     # local dev server
npx wrangler deploy                  # deploy to production
npx wrangler d1 execute DB --local --file=src/db/schema.sql   # init local DB
npx wrangler d1 execute DB --file=src/db/schema.sql           # init production DB
npx tsc --noEmit                     # type check
npx vitest run                       # run tests
npx wrangler types                   # regenerate Env type bindings
```

## Testing

- **Framework:** Vitest with `@cloudflare/vitest-pool-workers` for Worker-compatible test execution.
- **Config:** `vitest.config.ts` at project root.
- Tests live alongside source files as `*.test.ts` or in a `__tests__/` directory.
- Each collector/module should have at least a basic smoke test.
- Pre-commit hook runs `tsc --noEmit` to catch type errors before any commit lands.

## Architecture

```
Cron (hourly) → Collectors → AI Scoring → D1 → HTML Generation → KV → HTTP Response
```

- **`src/index.ts`** — Worker entry point. `scheduled()` runs the pipeline; `fetch()` serves pages from KV.
- **`src/collectors/*.ts`** — Each source type (RSS, Reddit, HN, YouTube, arXiv) has its own collector implementing the `Collector` interface. All return `CollectedArticle[]`.
- **`src/scoring/classifier.ts`** — Calls Claude Haiku API to score, tag, and summarize articles. Returns `ScoredArticle[]`.
- **`src/db/queries.ts`** — All D1 operations. Articles deduped by URL.
- **`src/renderer/html.ts`, `pages.ts`** — Template-literal HTML generation. No framework. Inline CSS, no client JS.
- **`src/renderer/rss.ts`** — RSS 2.0 XML feed generator.
- **`src/types.ts`** — Shared type contracts (`Article`, `CollectedArticle`, `ScoredArticle`, `Collector`, `Env`). All modules import from here.

## Key Design Constraints

- **No client-side JavaScript.** Pages are pure static HTML with inline CSS.
- **Page weight < 50KB.** No external stylesheets, fonts, or libraries.
- **Collectors must not throw.** Return empty arrays on failure and log errors — one broken source must not kill the cron job.
- **30-day rolling window.** Feed shows articles from the last 30 days.
- **Scoring threshold:** 40+ = published, 70+ = featured placement.
- **All HTML is pre-rendered into KV** during the cron job, not on request.

## Implementation Phases

Work is structured for parallel agent execution. See `SPEC.md` § "Implementation Plan (Agent-Parallelized)" for detailed per-agent specs, edge cases, and acceptance criteria.

- **Phase 0:** Scaffold — must complete before spawning any parallel agents
- **Phase 1 + 2:** 8 parallel agents in isolated worktrees (see team config below)
- **Phase 3:** Integration — merge worktrees, wire everything into `src/index.ts`
- **Phase 4:** Polish and deploy

## Agent Team Configuration

### Orchestration protocol

1. **Complete Phase 0 directly** (no agent needed — it's small enough to do inline).
2. **Commit Phase 0** so worktrees get a clean baseline.
3. **Spawn all Phase 1 + Phase 2 agents in a single message** using the Agent tool. All 8 are independent and run concurrently. Each uses `isolation: "worktree"`.
4. **Wait for all agents to complete.** Review each result.
5. **Merge worktree branches** into main sequentially. Resolve any conflicts (there should be none if agents stayed in their lanes).
6. **Run Phase 3 directly** — wire everything together in `src/index.ts`, create `src/db/seed.ts`.
7. **Type check:** `npx tsc --noEmit` must pass after integration.

### Agent definitions

Every agent prompt below should be prefixed with:
> Read SPEC.md and src/types.ts before writing any code. You are writing TypeScript for a Cloudflare Worker. Use only Web APIs (fetch, DOMParser, Response, etc.) — no Node.js built-ins. Export functions matching the shared interfaces in src/types.ts. Handle all errors gracefully (return empty arrays, log errors). Do not modify any files outside your designated list.

| ID | Description | Files to write | Isolation |
|----|-------------|---------------|-----------|
| 1A | RSS collector | `src/collectors/rss.ts` | worktree |
| 1B | Reddit collector | `src/collectors/reddit.ts` | worktree |
| 1C | Hacker News collector | `src/collectors/hackernews.ts` | worktree |
| 1D | YouTube collector | `src/collectors/youtube.ts` | worktree |
| 1E | arXiv collector | `src/collectors/arxiv.ts` | worktree |
| 2A | AI scoring pipeline | `src/scoring/classifier.ts` | worktree |
| 2B | HTML renderer | `src/renderer/html.ts`, `src/renderer/pages.ts` | worktree |
| 2C | RSS feed generator | `src/renderer/rss.ts` | worktree |

### Agent prompts

**1A — RSS Collector:**
Implement src/collectors/rss.ts. Fetch RSS/Atom feeds and return CollectedArticle[]. Parse XML with DOMParser (available in Workers). Handle both RSS 2.0 and Atom formats. Extract title, link, pubDate, description (truncated to 500 chars), and thumbnail (media:thumbnail or enclosure). Resolve relative URLs against the feed base URL. Handle CDATA content. See SPEC.md § "Agent 1A" for test sources and edge cases.

**1B — Reddit Collector:**
Implement src/collectors/reddit.ts. Fetch from Reddit's JSON API (append .json to URLs). Use OAuth app-only flow (client_credentials grant) for higher rate limits. The SourceConfig.config will contain `subreddit` and `query` fields. Search each subreddit for the configured query. Map Reddit posts to CollectedArticle[]. Handle both selftext and link posts. Handle 429 rate limiting with backoff. See SPEC.md § "Agent 1B".

**1C — Hacker News Collector:**
Implement src/collectors/hackernews.ts. Use the Algolia HN Search API (hn.algolia.com/api/v1/search). The SourceConfig.config will contain a `query` field. Query for relevant terms, filter by last 24 hours. Deduplicate results across multiple queries (by URL). Map HN stories to CollectedArticle[]. Skip Ask HN / comment-only posts. See SPEC.md § "Agent 1C".

**1D — YouTube Collector:**
Implement src/collectors/youtube.ts. Use YouTube Data API v3 search endpoint. The SourceConfig.config will contain either a `query` or `channelId` field. Extract video title, thumbnail URL (medium quality), description snippet (first 500 chars), and publishedAt. Construct video URLs as https://youtube.com/watch?v={videoId}. Be mindful of quota (each search costs 100 units out of 10K daily). See SPEC.md § "Agent 1D".

**2A — AI Scoring Pipeline:**
Implement src/scoring/classifier.ts. Export an async function that takes CollectedArticle[] and Env, calls Claude Haiku via fetch() to the Anthropic messages API, and returns ScoredArticle[]. Use the scoring prompt from SPEC.md § "AI Scoring Pipeline". Send articles individually (one API call per article) for MVP simplicity. Parse the JSON response to extract relevanceScore (number 0-100), tags (string[]), and aiSummary (string). On API error, retry once then assign score 0. See SPEC.md § "Agent 2A".

**2B — HTML Renderer:**
Implement src/renderer/html.ts (base layout, shared CSS, components) and src/renderer/pages.ts (page generators). Use template literal functions — no libraries. Requirements: mobile-first responsive, dark/light mode via prefers-color-scheme, inline CSS in a <style> tag, semantic HTML (article/time/header), OG meta tags, < 50KB per page, no client-side JS. Generate: homepage (featured articles score >= 70, then latest, 20 per page), paginated pages (/page/2, /page/3...), tag filter pages (/tag/{tag}), about page, sitemap.xml. Export functions that take Article[] and return Record<string, string> mapping URL paths to HTML strings. See SPEC.md § "Agent 2B" and § "Frontend".

**2C — RSS Feed Generator:**
Implement src/renderer/rss.ts. Export a function that takes Article[] and returns valid RSS 2.0 XML string. Channel: title "Agentic AI Accounting", link "https://agenticaiaccounting.com", description, lastBuildDate. Items: title, link, guid (permalink), description (aiSummary), pubDate (RFC 822), source, category for each tag. Ensure proper XML escaping. See SPEC.md § "Agent 2C".

### Merging worktrees

After all agents complete, merge each worktree branch into main:

```bash
# For each completed agent worktree branch:
git merge <branch-name> --no-edit
# Agents write to non-overlapping files, so no conflicts expected.
# If a conflict occurs, the integration phase (Phase 3) resolves it.
```

### Post-merge checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] All collectors export a function matching the `Collector` interface
- [ ] `classifier.ts` exports a scoring function taking `CollectedArticle[]`
- [ ] `pages.ts` exports page generators taking `Article[]`
- [ ] `rss.ts` exports a feed generator taking `Article[]`
- [ ] No files modified outside designated paths
