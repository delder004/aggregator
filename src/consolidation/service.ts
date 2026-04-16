import type { Env } from '../types';
import type { WeeklyWindow } from '../analytics/window';
import { getPreviousWeeklyWindow, parseStrictIsoTimestamp, getWeeklyWindow } from '../analytics/window';
import { writeBlob } from '../analytics/blob-store';
import {
  claimConsolidation,
  completeConsolidation,
  failConsolidation,
} from '../analytics/db';
import { callClaudeAPIWithModel } from '../insights/claude-api';
import { assembleConsolidationContext } from './context';
import {
  CONSOLIDATION_MODEL,
  CONSOLIDATION_MAX_TOKENS,
  CONSOLIDATION_SYSTEM_PROMPT,
  parseConsolidationResponse,
} from './prompt';

const BLOB_NAMESPACE = 'consolidations';

export interface ConsolidationRunOptions {
  windowStart?: string;
  /** Override the rankings window. Used by IngestWorkflow to pass
   *  currentWeek (the week the rankings sweep just ran for). */
  rankingsWindowStart?: string;
}

export interface ConsolidationRunResult {
  written: boolean;
  reason?: string;
  windowStart: string;
  windowEnd: string;
  contextTokenEstimate?: number;
  aiSummary?: string;
  proposalCount?: number;
}

/**
 * Run the weekly consolidation for one window.
 *
 * Default: previous complete weekly window. Override accepts a single
 * instant and resolves to the week containing it via getWeeklyWindow()
 * (same "snapshot the week containing this instant" semantics as the
 * competitor snapshot resolver).
 *
 * Steps:
 *   1. Resolve window + claim the run_consolidations row
 *   2. Assemble context from all six input families
 *   3. Call Sonnet with the consolidated prompt
 *   4. Parse + validate the AI response
 *   5. Persist context blob, AI output blob, and D1 metadata
 *
 * On any error after the claim, the row is marked failed (with the
 * error message) and the error is rethrown so the IngestWorkflow step
 * records it. The raw AI output is persisted even on parse failure so
 * the operator can inspect what the model returned.
 */
export async function runWeeklyConsolidation(
  env: Env,
  options: ConsolidationRunOptions = {}
): Promise<ConsolidationRunResult> {
  const { windowStart, windowEnd } = resolveConsolidationWindow(options);

  const claim = await claimConsolidation(env.DB, windowStart, windowEnd);
  if (!claim) {
    return {
      written: false,
      reason: 'window already complete or held by a fresh active claim',
      windowStart,
      windowEnd,
    };
  }

  // Track blob keys so they can be persisted even on failure. A parse
  // error or API error after blob writes must still record the keys in
  // D1 so /ops/consolidations/:id can show the context prompt and raw
  // AI response for debugging.
  let contextBlobKey: string | undefined;
  let aiOutputBlobKey: string | undefined;

  try {
    // Step 1: assemble context
    let rankingsWindow: WeeklyWindow | undefined;
    if (options.rankingsWindowStart) {
      const ms = parseStrictIsoTimestamp(options.rankingsWindowStart);
      if (ms === null) {
        throw new Error(
          `rankingsWindowStart must be a strict ISO 8601 timestamp with an ` +
            `explicit Z or ±HH:MM offset (got ${options.rankingsWindowStart})`
        );
      }
      rankingsWindow = getWeeklyWindow(new Date(ms));
    }
    const context = await assembleConsolidationContext(env, {
      window: { windowStart, windowEnd },
      rankingsWindow,
    });
    const contextBlob = await writeBlob(
      env.KV,
      BLOB_NAMESPACE,
      windowStart,
      `${claim.id}-context`,
      { prompt: context.prompt, inputRefs: context.inputRefs }
    );
    contextBlobKey = contextBlob.key;

    // Step 2: call Sonnet
    const aiResponse = await callClaudeAPIWithModel(
      CONSOLIDATION_MODEL,
      CONSOLIDATION_SYSTEM_PROMPT,
      context.prompt,
      env,
      CONSOLIDATION_MAX_TOKENS
    );

    // Step 3: persist raw AI output before parsing (so parse failures
    // still have the raw response available for debugging)
    const aiOutputBlob = await writeBlob(
      env.KV,
      BLOB_NAMESPACE,
      windowStart,
      `${claim.id}-output`,
      { rawText: aiResponse.text, usage: aiResponse.usage }
    );
    aiOutputBlobKey = aiOutputBlob.key;

    // Step 4: parse + validate
    const parsed = parseConsolidationResponse(aiResponse.text);

    // Step 5: complete the D1 row
    const ok = await completeConsolidation(
      env.DB,
      windowStart,
      windowEnd,
      claim.attemptCount,
      {
        inputRunIds: context.inputRefs.pipelineRunIds,
        inputSnapshotIds: context.inputRefs.snapshotIds,
        contextBlobKey: contextBlob.key,
        contextTokenEstimate: context.tokenEstimate,
        aiModel: CONSOLIDATION_MODEL,
        aiOutputBlobKey: aiOutputBlob.key,
        aiSummary: parsed.summary,
        aiProposals: parsed.proposals,
        aiTokenUsage: {
          inputTokens: aiResponse.usage.inputTokens,
          outputTokens: aiResponse.usage.outputTokens,
        },
      }
    );

    if (!ok) {
      return {
        written: false,
        reason: 'consolidation was reclaimed by another worker mid-flight',
        windowStart,
        windowEnd,
        contextTokenEstimate: context.tokenEstimate,
      };
    }

    return {
      written: true,
      windowStart,
      windowEnd,
      contextTokenEstimate: context.tokenEstimate,
      aiSummary: parsed.summary,
      proposalCount: parsed.proposals.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failConsolidation(
      env.DB,
      windowStart,
      windowEnd,
      claim.attemptCount,
      message,
      { contextBlobKey, aiOutputBlobKey }
    ).catch(() => {
      // If even the failure record fails, we still rethrow the original.
    });
    throw err;
  }
}

export function resolveConsolidationWindow(
  options: ConsolidationRunOptions
): WeeklyWindow {
  if (options.windowStart) {
    const ms = parseStrictIsoTimestamp(options.windowStart);
    if (ms === null) {
      throw new Error(
        `windowStart must be a strict ISO 8601 timestamp with an explicit ` +
          `Z or ±HH:MM offset (got ${options.windowStart})`
      );
    }
    return getWeeklyWindow(new Date(ms));
  }
  return getPreviousWeeklyWindow();
}
