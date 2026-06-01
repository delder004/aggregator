# Search feature — exploration

Status: exploration / design only. No production code changed yet.

## Goal

Let visitors search the published article corpus by keyword from any page, and
land on a results page that respects the site's hard constraints (no client JS,
pre-rendered-where-possible, page weight < 50KB).

## How the site is built (relevant facts)

- **`src/index.ts` `fetch()`** is a router. Most paths are served as pre-rendered
  HTML straight out of KV (`env.KV.get(path)`), populated by the hourly cron.
  But two routes are rendered **dynamically at request time**:
  - `/article/:id` — queries D1 (`getArticleById`, related, companies) and
    builds HTML on the fly with `layout(...)`.
  - `/subscribe` (POST) — form handler.
- **`src/renderer/html.ts` `layout(body, options)`** wraps every page. The header
  nav (`tabs` array, line ~2114) is where a search box would live. Footer too.
- **`src/db/schema.sql`** — `articles` table holds the searchable text:
  `title`, `headline`, `ai_summary`, `content_snippet`, `tags`,
  `company_mentions`, `source_name`, `author`. There is **no FTS table today.**
- **`src/db/queries.ts`** — all D1 access. No search query exists yet.

### Why this is a good fit

Search is inherently dynamic (the query is unknown at cron time), so it does
**not** need to be pre-rendered into KV. It slots in exactly like `/article/:id`:
a new dynamic route in `fetch()` that reads `?q=`, queries D1, and renders with
`layout()`. **A plain HTML `<form method="GET" action="/search">` needs zero
client JS** — the browser serializes the input into `?q=...` itself.

## Design

### 1. UI — search box in the header (and/or a `/search` landing page)

```html
<form class="header-search" method="GET" action="/search" role="search">
  <input type="search" name="q" placeholder="Search articles…"
         value="{{escaped current q}}" aria-label="Search articles" />
  <button type="submit">Search</button>
</form>
```

Add to the `header-row` in `layout()` and style in `getCSS()`. Pure HTML form,
GET method — submitting navigates to `/search?q=...`. No JS, no weight cost.

### 2. Route — `/search?q=...` in `fetch()`

Mirror the `/article/:id` block: parse `q`, run the search query, render
result cards with the existing `articleCard()` helper, wrap in `layout()`.
Return `Cache-Control: public, max-age=300` and let the edge cache memoize
popular queries (the existing cache key is the full URL incl. query string, so
this works automatically). Mark the page `noindex` to avoid thin/duplicate
search-results pages in Google's index (standard SEO practice), while still
letting it be linked.

### 3. Backend — two options

#### Option A — `LIKE` scan (smallest change)

```sql
SELECT * FROM articles
WHERE is_published = 1
  AND (title LIKE ?1 OR headline LIKE ?1 OR ai_summary LIKE ?1
       OR content_snippet LIKE ?1 OR company_mentions LIKE ?1)
ORDER BY relevance_score DESC, published_at DESC
LIMIT 50;
```
with `?1 = '%' + escapedTerm + '%'`.

- **Pros:** one new function in `queries.ts`, no migration, no backfill, no
  sync triggers. Ships in one PR.
- **Cons:** no relevance ranking by match quality, no stemming/tokenization,
  substring matches only (`tax` matches `syntax`), full table scan (fine at the
  current corpus scale of a few thousand rows, but unbounded).

#### Option B — SQLite FTS5 virtual table (the "right" version)

D1 supports FTS5. Add a contentless/external-content FTS table over the
searchable columns, keep it in sync with triggers, backfill once.

```sql
-- migration-NNN-articles-fts.sql
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, headline, ai_summary, content_snippet, company_mentions,
  content='articles', content_rowid='rowid', tokenize='porter unicode61'
);
-- + AFTER INSERT/UPDATE/DELETE triggers mirroring articles → articles_fts
-- + one-time backfill: INSERT INTO articles_fts(rowid, ...) SELECT ... FROM articles;
```

Query with `articles_fts MATCH ?` ordered by `bm25(articles_fts)`.

- **Pros:** real ranking (bm25), prefix (`tax*`) and phrase queries, stemming
  via porter, scales. Best search quality.
- **Cons:** migration + triggers + backfill (follow the `migration-NNN-*.sql`
  convention in CLAUDE.md, run on prod). Triggers add a little write overhead
  to the ingest path. More surface to test.

## Recommendation

Ship **Option A first** — it's a single dynamic route + one query + a header
form, delivers a usable feature immediately at the current corpus size, and is
trivially reversible. Treat **Option B (FTS5)** as a fast follow once we confirm
people actually use search (the `recordPageView` engagement instrumentation on
`/search` will tell us). The UI and route are identical for both; only the
`queries.ts` function body and the migration differ, so the upgrade is contained.

## Touch list (Option A)

| File | Change |
|---|---|
| `src/renderer/html.ts` | Add `header-search` form to `layout()`; add CSS in `getCSS()`. |
| `src/db/queries.ts` | New `searchArticles(db, term, limit)` (LIKE query, escape `%`/`_`). |
| `src/index.ts` | New `/search` route in `fetch()`: parse `q`, call `searchArticles`, render with `articleCard()` + `layout({ noindex: true })`. Add `recordPageView`. |
| `src/renderer/*.test.ts` / new test | Smoke test: query returns rows; empty `q` renders an empty-state page. |

## Open questions for the user

1. Search box in the **global header** (every page) or only a dedicated
   `/search` page linked from the nav?
2. **Option A (LIKE, ship now)** or go straight to **Option B (FTS5)**?
3. Scope of corpus: published articles only, or also companies / jobs / tags?
