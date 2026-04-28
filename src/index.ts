import type { Env, RunTriggerType, RunWorkflowParams } from './types';
import {
  getArticleById,
  getPipelineRunById,
  getPipelineRunSteps,
  getRelatedArticles,
  listPipelineRuns,
} from './db/queries';
import { layout, articleCard, escapeHtml, readTime } from './renderer/html';
import { addSubscriberToButtondown } from './newsletter/buttondown';
import {
  runArticleViewsRollup,
  writeArticleViewEvent,
} from './analytics/analytics-engine';
import {
  writeConversionEvent,
  writePageViewEvent,
} from './analytics/engagement-events';
import { deriveSessionId } from './analytics/session';
import { runCfAnalyticsSnapshot } from './analytics/cloudflare';
import { runSearchConsoleSnapshot } from './analytics/search-console';
import { runRankingsSweep } from './analytics/rankings';
import { runCompetitorSnapshots } from './competitors/snapshot';
import { runWeeklyConsolidation } from './consolidation/service';
import {
  getCfAnalyticsSnapshotById,
  getCompetitorSnapshotById,
  getConsolidationById,
  getIngestStatus,
  getSearchConsoleSnapshotById,
  listCfAnalyticsSnapshots,
  listCompetitorSnapshots,
  listConsolidations,
  listRecentKeywordRankings,
  listSearchConsoleSnapshots,
  listSourceCandidates,
} from './analytics/db';
import { readBlob } from './analytics/blob-store';

export { CollectWorkflow, ProcessWorkflow } from './workflow';
export { IngestWorkflow } from './ingest';

function isOpsAuthorized(request: Request, env: Env): boolean {
  return Boolean(env.CRON_SECRET && request.headers.get('X-Cron-Key') === env.CRON_SECRET);
}

/**
 * Fire-and-forget page-view recorder. Derives the session id (one KV read)
 * and writes the AE event off the response path via ctx.waitUntil. Safe to
 * call on any HTML response; never throws.
 */
function recordPageView(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string
): void {
  if (!env.AE_ENGAGEMENT) return;
  ctx.waitUntil(
    (async () => {
      const sessionId = await deriveSessionId(request, env.KV);
      if (!sessionId) return;
      writePageViewEvent(env, {
        sessionId,
        path,
        referrer: request.headers.get('Referer'),
        country:
          (request as unknown as { cf?: { country?: string } }).cf?.country ??
          null,
        userAgent: request.headers.get('User-Agent'),
      });
    })().catch(() => {
      // best-effort
    })
  );
}

/**
 * Fire-and-forget conversion recorder. Used after a successful newsletter
 * signup so the event can be tied back to the same session that landed the
 * user on the site.
 */
function recordConversion(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  conversionType: 'newsletter'
): void {
  if (!env.AE_ENGAGEMENT) return;
  ctx.waitUntil(
    (async () => {
      const sessionId = await deriveSessionId(request, env.KV);
      if (!sessionId) return;
      writeConversionEvent(env, {
        sessionId,
        conversionType,
        path,
        country:
          (request as unknown as { cf?: { country?: string } }).cf?.country ??
          null,
        userAgent: request.headers.get('User-Agent'),
      });
    })().catch(() => {
      // best-effort
    })
  );
}

async function startPipeline(env: Env, triggerType: RunTriggerType, triggerSource: string) {
  const pipelineRunId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const params: RunWorkflowParams = {
    pipelineRunId,
    triggerType,
    triggerSource,
    startedAt,
  };
  const collectInstance = await env.COLLECT_WORKFLOW.create({ params });
  const processInstance = await env.PROCESS_WORKFLOW.create({ params });
  return { pipelineRunId, collectInstance, processInstance };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize: strip trailing slash except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // robots.txt
    if (path === '/robots.txt') {
      return new Response(
        `User-agent: *\nAllow: /\n\nSitemap: https://agenticaiaccounting.com/sitemap.xml\n`,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }
      );
    }

    if (path === '/ops/runs') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }

      const limitParam = Number(url.searchParams.get('limit') || '20');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(100, Math.floor(limitParam)))
        : 20;
      const runs = await listPipelineRuns(env.DB, limit);
      return new Response(JSON.stringify({ runs }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const runMatch = path.match(/^\/ops\/runs\/([a-f0-9-]+)$/);
    if (runMatch) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }

      const runId = runMatch[1];
      const run = await getPipelineRunById(env.DB, runId);
      if (!run) {
        return new Response('Not Found', { status: 404 });
      }
      const steps = await getPipelineRunSteps(env.DB, runId);
      return new Response(JSON.stringify({ run, steps }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Phase 1 capture layer: article-views rollup inspection + manual trigger.
    if (path === '/ops/article-views') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '100');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(500, Math.floor(limitParam)))
        : 100;
      const offsetParam = Number(url.searchParams.get('offset') || '0');
      const offset = Number.isFinite(offsetParam)
        ? Math.max(0, Math.floor(offsetParam))
        : 0;
      const sinceDate =
        url.searchParams.get('since') ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      const result = await env.DB
        .prepare(
          `SELECT article_id, view_date, views, unique_visitors,
                  top_referrer, updated_at
           FROM article_views
           WHERE view_date >= ?
           ORDER BY view_date DESC, views DESC
           LIMIT ? OFFSET ?`
        )
        .bind(sinceDate, limit, offset)
        .all();
      return new Response(
        JSON.stringify({
          since: sinceDate,
          limit,
          offset,
          count: result.results.length,
          rows: result.results,
        }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // CF GraphQL zone analytics: snapshot list / detail / manual trigger.
    if (path === '/ops/cf-analytics') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '20');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(100, Math.floor(limitParam)))
        : 20;
      const snapshots = await listCfAnalyticsSnapshots(env.DB, limit);
      return new Response(
        JSON.stringify({ count: snapshots.length, snapshots }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const cfSnapshotMatch = path.match(/^\/ops\/cf-analytics\/([a-f0-9-]+)$/);
    if (cfSnapshotMatch) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const snapshot = await getCfAnalyticsSnapshotById(env.DB, cfSnapshotMatch[1]);
      if (!snapshot) {
        return new Response('Not Found', { status: 404 });
      }
      const blob = snapshot.blobKey ? await readBlob(env.KV, snapshot.blobKey) : null;
      return new Response(JSON.stringify({ snapshot, blob }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (path === '/ops/cron/cf-analytics-snapshot' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        const zoneParam = url.searchParams.get('zone');
        const options: {
          windowStart?: string;
          windowEnd?: string;
          zoneTag?: string;
        } = {};
        if (fromParam) options.windowStart = fromParam;
        if (toParam) options.windowEnd = toParam;
        if (zoneParam) options.zoneTag = zoneParam;
        const result = await runCfAnalyticsSnapshot(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Google Search Console: snapshot list / detail / manual trigger.
    if (path === '/ops/search-console') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '20');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(100, Math.floor(limitParam)))
        : 20;
      const snapshots = await listSearchConsoleSnapshots(env.DB, limit);
      return new Response(
        JSON.stringify({ count: snapshots.length, snapshots }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const gscSnapshotMatch = path.match(/^\/ops\/search-console\/([a-f0-9-]+)$/);
    if (gscSnapshotMatch) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const snapshot = await getSearchConsoleSnapshotById(
        env.DB,
        gscSnapshotMatch[1]
      );
      if (!snapshot) {
        return new Response('Not Found', { status: 404 });
      }
      const blob = snapshot.blobKey
        ? await readBlob(env.KV, snapshot.blobKey)
        : null;
      return new Response(JSON.stringify({ snapshot, blob }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (
      path === '/ops/cron/search-console-snapshot' &&
      request.method === 'POST'
    ) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        const siteParam = url.searchParams.get('site');
        const options: {
          windowStart?: string;
          windowEnd?: string;
          siteUrl?: string;
        } = {};
        if (fromParam) options.windowStart = fromParam;
        if (toParam) options.windowEnd = toParam;
        if (siteParam) options.siteUrl = siteParam;
        const result = await runSearchConsoleSnapshot(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Serper rankings sweep: inspection + manual trigger.
    if (path === '/ops/rankings') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '100');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(500, Math.floor(limitParam)))
        : 100;
      const rankings = await listRecentKeywordRankings(env.DB, limit);
      return new Response(
        JSON.stringify({ count: rankings.length, rankings }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (path === '/ops/cron/rankings-sweep' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const windowParam = url.searchParams.get('window');
        const hostnameParam = url.searchParams.get('hostname');
        const options: {
          windowStart?: string;
          hostname?: string;
        } = {};
        if (windowParam) options.windowStart = windowParam;
        if (hostnameParam) options.hostname = hostnameParam;
        const result = await runRankingsSweep(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Competitor snapshots: inspection + manual trigger.
    if (path === '/ops/competitors') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '50');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(200, Math.floor(limitParam)))
        : 50;
      const snapshots = await listCompetitorSnapshots(env.DB, limit);
      return new Response(
        JSON.stringify({ count: snapshots.length, snapshots }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const compSnapshotMatch = path.match(/^\/ops\/competitors\/([a-f0-9-]+)$/);
    if (compSnapshotMatch) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const snapshot = await getCompetitorSnapshotById(
        env.DB,
        compSnapshotMatch[1]
      );
      if (!snapshot) {
        return new Response('Not Found', { status: 404 });
      }
      const blob = snapshot.blobKey
        ? await readBlob(env.KV, snapshot.blobKey)
        : null;
      return new Response(JSON.stringify({ snapshot, blob }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (path === '/ops/cron/competitor-snapshots' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const windowParam = url.searchParams.get('window');
        const options: { windowStart?: string } = {};
        if (windowParam) options.windowStart = windowParam;
        const result = await runCompetitorSnapshots(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Source candidates inspection.
    if (path === '/ops/source-candidates') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const statusParam = url.searchParams.get('status') as
        | 'new'
        | 'approved'
        | 'rejected'
        | 'shipped'
        | null;
      const limitParam = Number(url.searchParams.get('limit') || '100');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(500, Math.floor(limitParam)))
        : 100;
      const candidates = await listSourceCandidates(
        env.DB,
        statusParam ?? undefined,
        limit
      );
      return new Response(
        JSON.stringify({ count: candidates.length, candidates }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Weekly consolidation: list / detail / manual trigger.
    if (path === '/ops/consolidations') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const limitParam = Number(url.searchParams.get('limit') || '20');
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(100, Math.floor(limitParam)))
        : 20;
      const consolidations = await listConsolidations(env.DB, limit);
      return new Response(
        JSON.stringify({ count: consolidations.length, consolidations }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const consolidationMatch = path.match(
      /^\/ops\/consolidations\/([a-f0-9-]+)$/
    );
    if (consolidationMatch) {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const consolidation = await getConsolidationById(
        env.DB,
        consolidationMatch[1]
      );
      if (!consolidation) {
        return new Response('Not Found', { status: 404 });
      }
      const contextBlob = consolidation.contextBlobKey
        ? await readBlob(env.KV, consolidation.contextBlobKey)
        : null;
      const aiOutputBlob = consolidation.aiOutputBlobKey
        ? await readBlob(env.KV, consolidation.aiOutputBlobKey)
        : null;
      return new Response(
        JSON.stringify({ consolidation, contextBlob, aiOutputBlob }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (path === '/ops/cron/consolidate' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const windowParam = url.searchParams.get('window');
        const options: { windowStart?: string } = {};
        if (windowParam) options.windowStart = windowParam;
        const result = await runWeeklyConsolidation(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Ingest workflow: per-namespace status + manual trigger.
    if (path === '/ops/ingest/status') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const namespaces = await getIngestStatus(env.DB);
      return new Response(JSON.stringify({ namespaces }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (path === '/ops/cron/ingest' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const pipelineRunId = crypto.randomUUID();
      const instance = await env.INGEST_WORKFLOW.create({
        params: {
          pipelineRunId,
          triggerType: 'manual',
          triggerSource: '/ops/cron/ingest',
          startedAt: new Date().toISOString(),
        },
      });
      return new Response(
        JSON.stringify({
          status: 'started',
          pipelineRunId,
          instanceId: instance.id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    if (path === '/ops/cron/article-views-rollup' && request.method === 'POST') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const fromDateParam = url.searchParams.get('from_date');
        const toDateParam = url.searchParams.get('to_date');
        const daysParam = url.searchParams.get('days');
        const options: {
          fromDate?: string;
          toDate?: string;
          days?: number;
        } = {};
        if (fromDateParam) options.fromDate = fromDateParam;
        if (toDateParam) options.toDate = toDateParam;
        if (daysParam) {
          const n = Number(daysParam);
          if (!Number.isFinite(n)) {
            return new Response(
              JSON.stringify({ status: 'error', error: 'days must be a number' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
              }
            );
          }
          options.days = Math.floor(n);
        }
        const result = await runArticleViewsRollup(env, options);
        return new Response(JSON.stringify({ status: 'ok', ...result }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      }
    }

    // Manual cron trigger endpoint (authenticated via dedicated secret)
    if (path === '/cron') {
      if (!isOpsAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const { pipelineRunId, collectInstance, processInstance } = await startPipeline(
        env,
        'manual',
        '/cron'
      );
      return new Response(JSON.stringify({
        status: 'started',
        pipelineRunId,
        collectInstanceId: collectInstance.id,
        processInstanceId: processInstance.id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }


    // Newsletter subscribe endpoint (HTML form POST, no JS)
    if (path === '/subscribe' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const email = (formData.get('email') as string || '').trim().toLowerCase();

        // Basic email validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.redirect(`${url.origin}/?subscribed=invalid`, 303);
        }

        await env.DB.prepare(
          'INSERT OR IGNORE INTO subscribers (email, subscribed_at) VALUES (?, ?)'
        ).bind(email, new Date().toISOString()).run();

        // Sync subscriber to Buttondown (non-blocking — D1 is source of truth)
        if (env.BUTTONDOWN_API_KEY) {
          const synced = await addSubscriberToButtondown(env.BUTTONDOWN_API_KEY, email);
          if (!synced) {
            console.error(`Buttondown sync failed for ${email}, D1 record saved`);
          }
        }

        // Record conversion against the originating session so the rollup
        // can attribute newsletter signups back to a landing page.
        recordConversion(request, env, ctx, '/subscribe', 'newsletter');

        return Response.redirect(`${url.origin}/?subscribed=1`, 303);
      } catch {
        return Response.redirect(`${url.origin}/?subscribed=error`, 303);
      }
    }

    // Dynamic article detail page
    const articleMatch = path.match(/^\/article\/([a-f0-9-]+)$/);
    if (articleMatch) {
      const articleId = articleMatch[1];
      const article = await getArticleById(env.DB, articleId);

      if (!article) {
        return new Response('Not Found', { status: 404 });
      }

      // Best-effort Analytics Engine write. Sync-enqueue per CF docs, never
      // awaited, never throws into the response path. The function itself
      // already swallows binding errors — see analytics-engine.ts.
      writeArticleViewEvent(env, {
        articleId,
        referer: request.headers.get('Referer'),
        country:
          (request as unknown as { cf?: { country?: string } }).cf?.country ??
          null,
        userAgent: request.headers.get('User-Agent'),
      });
      // Engagement page-view (separate dataset; runs async via waitUntil).
      recordPageView(request, env, ctx, path);

      const related = await getRelatedArticles(env.DB, article);

      // Build article detail body
      const title = escapeHtml(article.headline || article.title);
      const summary = article.aiSummary ? escapeHtml(article.aiSummary) : '';

      let detailBody = `<div class="article-detail">`;
      detailBody += `<h1>${title}</h1>`;
      detailBody += `<div class="article-meta">`;
      let sourceSiteUrl = '';
      try { sourceSiteUrl = new URL(article.url).origin; } catch {}
      detailBody += sourceSiteUrl
        ? `<a href="${escapeHtml(sourceSiteUrl)}" class="source-name" target="_blank" rel="noopener">${escapeHtml(article.sourceName)}</a>`
        : `<span class="source-name">${escapeHtml(article.sourceName)}</span>`;
      if (article.author) {
        detailBody += ` <span class="meta-dot">&middot;</span> ${escapeHtml(article.author)}`;
      }
      detailBody += ` <span class="meta-dot">&middot;</span> <time datetime="${article.publishedAt}">${new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>`;
      detailBody += ` <span class="meta-dot">&middot;</span> ${readTime(article)}`;
      if (article.relevanceScore) {
        detailBody += ` <span class="meta-dot">&middot;</span> Relevance: ${article.relevanceScore}/100`;
      }
      if (article.transcript) {
        detailBody += ` <span class="meta-dot">&middot;</span> <a href="#transcript" style="background:var(--accent,#10b981);color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;text-decoration:none;">Transcript available</a>`;
      }
      detailBody += `</div>`;

      if (article.transcriptSummary) {
        // Render structured TLDW + key points from transcript
        const lines = article.transcriptSummary.split('\n').filter(l => l.trim());
        let summaryHtml = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('TLDW:') || trimmed.startsWith('**TLDW')) {
            const text = escapeHtml(trimmed.replace(/^\*?\*?TLDW:?\*?\*?\s*/i, ''));
            summaryHtml += `<p style="margin:0 0 0.75rem 0;"><strong>TLDW:</strong> ${text}</p>`;
          } else if (trimmed.startsWith('Key points:') || trimmed.startsWith('**Key points')) {
            summaryHtml += `<p style="margin:0.75rem 0 0.25rem 0;font-weight:600;">Key points:</p><ul style="margin:0;padding-left:1.25rem;">`;
          } else if (trimmed.startsWith('- ')) {
            summaryHtml += `<li style="margin-bottom:0.35rem;">${escapeHtml(trimmed.slice(2))}</li>`;
          } else {
            summaryHtml += `<p style="margin:0 0 0.5rem 0;">${escapeHtml(trimmed)}</p>`;
          }
        }
        // Close any open <ul>
        if (summaryHtml.includes('<ul') && !summaryHtml.includes('</ul>')) {
          summaryHtml += '</ul>';
        }
        detailBody += `<div class="article-summary" style="line-height:1.6;">${summaryHtml}</div>`;
      } else if (summary) {
        detailBody += `<p class="article-summary">${summary}</p>`;
      }

      if (article.tags.length > 0) {
        detailBody += `<div class="article-tags">${article.tags.map(t => `<a href="/tag/${escapeHtml(t)}">${escapeHtml(t)}</a>`).join('')}</div>`;
      }

      if (article.companyMentions.length > 0) {
        detailBody += `<div class="article-tags">${article.companyMentions.map(c => `<a class="company-tag" href="/companies">${escapeHtml(c)}</a>`).join('')}</div>`;
      }

      detailBody += `<a class="original-link" href="${escapeHtml(article.url)}" rel="noopener" target="_blank">Read original article &rarr;</a>`;

      // Share buttons (no JS — pure URL-based sharing)
      const shareTitle = encodeURIComponent(article.headline || article.title);
      const shareUrl = encodeURIComponent(`https://agenticaiaccounting.com/article/${articleId}`);
      const xIcon = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
      const linkedInIcon = `<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
      const emailIcon = `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
      detailBody += `<div class="share-bar">
        <span>Share:</span>
        <a class="share-btn x" href="https://x.com/intent/tweet?text=${shareTitle}&amp;url=${shareUrl}" target="_blank" rel="noopener">${xIcon} Post</a>
        <a class="share-btn linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">${linkedInIcon} Share</a>
        <a class="share-btn email" href="mailto:?subject=${shareTitle}&amp;body=Check%20out%20this%20article%3A%20${shareUrl}" rel="noopener">${emailIcon} Email</a>
      </div>`;

      if (article.transcript) {
        detailBody += `<div id="transcript" style="margin-top:1.5rem;border-top:1px solid var(--border,#e5e7eb);padding-top:1.5rem;">`;
        detailBody += `<details>`;
        detailBody += `<summary style="cursor:pointer;font-weight:600;font-size:0.95rem;color:var(--text-secondary,#6b7280);">View Transcript</summary>`;
        // Format transcript: split on >> speaker markers into paragraphs
        const formattedTranscript = escapeHtml(article.transcript)
          .split(/\s*&gt;&gt;\s*/)
          .filter(s => s.trim())
          .map(s => `<p style="margin:0 0 0.75rem 0;">${s.trim()}</p>`)
          .join('');
        detailBody += `<div style="margin-top:0.75rem;padding:1rem;background:var(--card-bg,#f9fafb);border-radius:8px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary,#6b7280);max-height:500px;overflow-y:auto;">${formattedTranscript}</div>`;
        detailBody += `</details>`;
        detailBody += `</div>`;
      }

      detailBody += `</div>`;

      // Related articles
      if (related.length > 0) {
        detailBody += `<div class="related-section">`;
        detailBody += `<div class="section-label">Related Articles</div>`;
        detailBody += related.map(a => articleCard(a)).join('\n');
        detailBody += `</div>`;
      }

      const articleJsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        'headline': article.headline || article.title,
        'datePublished': article.publishedAt,
        'url': `https://agenticaiaccounting.com/article/${articleId}`,
        'publisher': {
          '@type': 'Organization',
          'name': 'Agentic AI Accounting',
          'url': 'https://agenticaiaccounting.com',
          'logo': { '@type': 'ImageObject', 'url': 'https://agenticaiaccounting.com/og.png' },
        },
        'mainEntityOfPage': { '@type': 'WebPage', '@id': `https://agenticaiaccounting.com/article/${articleId}` },
      };
      if (article.author) {
        articleJsonLd['author'] = { '@type': 'Person', 'name': article.author };
      }
      if (article.aiSummary) {
        articleJsonLd['description'] = article.aiSummary;
      }

      const html = layout(detailBody, {
        title: article.headline || article.title,
        description: article.aiSummary || `Article about ${article.title}`,
        path: `/article/${articleId}`,
        jsonLd: articleJsonLd,
      });

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // Serve pre-rendered pages from KV
    const cached = await env.KV.get(path, 'text');
    if (cached) {
      // OG image stored as base64-prefixed PNG
      if (cached.startsWith('__PNG_BASE64__')) {
        const b64 = cached.slice('__PNG_BASE64__'.length);
        const binaryString = atob(b64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Response(bytes, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      const isXml = path.endsWith('.xml');
      let content = cached;

      // Inject newsletter subscription confirmation into HTML pages
      const subscribed = url.searchParams.get('subscribed');
      if (subscribed && !isXml) {
        const msgs: Record<string, string> = {
          '1': 'Thanks for subscribing! You\u2019ll hear from us soon.',
          'invalid': 'Please enter a valid email address.',
          'error': 'Something went wrong. Please try again.',
        };
        const msg = msgs[subscribed];
        if (msg) {
          const isSuccess = subscribed === '1';
          const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;padding:0.75rem 1rem;text-align:center;font-size:0.88rem;font-weight:500;color:#fff;background:${isSuccess ? '#0f766e' : '#dc2626'};">${escapeHtml(msg)}</div>`;
          content = content.replace('<body>', `<body>${banner}`);
        }
      }

      // Record an engagement page view for HTML responses only — skip XML
      // (sitemap, feed) since those are typically machine consumers.
      if (!isXml) {
        recordPageView(request, env, ctx, path);
      }

      return new Response(content, {
        headers: {
          'Content-Type': isXml
            ? 'application/xml; charset=utf-8'
            : 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Weekly ingest cron (Monday 13:00 UTC): dispatch IngestWorkflow.
    // Hourly cron: dispatch Collect + Process pipeline as before.
    // ScheduledEvent.cron is always provided by the Workers runtime.
    if (event.cron === '0 13 * * 1') {
      const pipelineRunId = crypto.randomUUID();
      const instance = await env.INGEST_WORKFLOW.create({
        params: {
          pipelineRunId,
          triggerType: 'scheduled',
          triggerSource: 'weekly-ingest-cron',
          startedAt: new Date().toISOString(),
        },
      });
      console.log(
        `Ingest workflow ${instance.id} started for pipeline run ${pipelineRunId}`
      );
      return;
    }

    const { pipelineRunId, collectInstance, processInstance } = await startPipeline(
      env,
      'scheduled',
      'cron'
    );
    console.log(
      `Pipeline run ${pipelineRunId} started. ` +
      `Collect workflow: ${collectInstance.id}, Process workflow: ${processInstance.id}`
    );
  },
};
