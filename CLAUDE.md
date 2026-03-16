# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agenticaiaccounting.com** — a fully automated news aggregator for agentic AI in accounting. Cloudflare Worker collects content hourly from RSS, Reddit, HN, YouTube, and arXiv, scores relevance with Claude Haiku, and serves pre-rendered static HTML.

## Stack

- **Runtime:** Cloudflare Worker (TypeScript) with cron trigger
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV (pre-rendered HTML pages)
- **AI:** Claude API (Haiku, model `claude-haiku-4-5-20251001`) for relevance scoring
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

- **`src/index.ts`** — Worker entry point. `scheduled()` calls `runPipeline()`; `fetch()` serves pages from KV. A `/cron` endpoint also triggers the pipeline for manual runs.
- **`src/collectors/*.ts`** — Each source type (RSS, Reddit, HN, YouTube, arXiv) has its own collector implementing the `Collector` interface. All return `CollectedArticle[]`.
- **`src/scoring/classifier.ts`** — Calls Claude Haiku API to score, tag, and summarize articles. Returns `ScoredArticle[]`.
- **`src/db/queries.ts`** — All D1 operations. Articles deduped by URL. Uses batched inserts and IN-clause dedup queries.
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

## Cloudflare Workers Constraints

- **1,000 subrequest limit** per invocation (fetch calls + D1 queries all count). Batch D1 operations (IN clauses, `d1.batch()`) and cap external API calls per run.
- **CPU time limits.** Scoring is capped at 100 articles per cron run with 10 concurrent requests. Unscored articles are stored and picked up on subsequent runs.
- **No `this` in module exports.** Pipeline logic lives in a standalone `runPipeline()` function, not a method — both `scheduled()` and the `/cron` fetch route call it directly.
- **Web APIs only.** No Node.js built-ins. Use `fetch`, `DOMParser`, `Response`, etc.

## Parallel Agent Work

When spawning agents for parallel work in this repo:

- **Use `isolation: "worktree"`** so each agent gets its own branch and working copy.
- **Assign non-overlapping files** to each agent to avoid merge conflicts.
- **Commit Phase 0 / shared scaffolding first** so worktree branches have a clean baseline.
- **Spawn all independent agents in a single message** for true concurrency.
- **Merge worktree branches sequentially** after all agents complete (`git merge <branch> --no-edit`).
- **Run `npx tsc --noEmit`** after merging to catch integration issues.
- Every agent prompt should include: "You are writing TypeScript for a Cloudflare Worker. Use only Web APIs — no Node.js built-ins. Export functions matching the shared interfaces in `src/types.ts`. Handle all errors gracefully. Do not modify files outside your designated list."
