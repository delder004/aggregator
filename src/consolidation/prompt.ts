import type { ConsolidationProposal } from '../analytics/types';
import type { ConsolidationAIResult } from './types';
import { extractJsonObject } from '../runs/retrospective';

export const CONSOLIDATION_MODEL = 'claude-3-5-sonnet-20241022';
export const CONSOLIDATION_MAX_TOKENS = 2048;

export const CONSOLIDATION_SYSTEM_PROMPT = `You are a strategic analyst for agenticaiaccounting.com, an automated news aggregator covering agentic AI in accounting.

You will receive a weekly context bundle containing:
- Pipeline run summaries with AI retrospectives
- Cloudflare zone analytics (traffic totals)
- Google Search Console data (queries, pages, impressions, clicks, CTR)
- Keyword ranking positions and week-over-week deltas
- Competitor content snapshots (what they published this week)
- Top articles by views with their relevance scores and tags

Analyze all inputs together and return valid JSON with this exact schema:
{
  "summary": "<2-3 sentence overview of this week>",
  "whatWorked": ["<item>", ...],
  "whatDidnt": ["<item>", ...],
  "proposals": [
    {
      "type": "<source | threshold | topic | keyword | competitor>",
      "action": "<add | remove | adjust | investigate>",
      "target": "<specific thing to change>",
      "rationale": "<why, citing specific data from the context>",
      "confidence": "<high | medium | low>",
      "priority": "<high | medium | low>"
    }
  ],
  "topicGaps": ["<topic competitors cover that we don't>", ...],
  "keywordOpportunities": ["<keyword where we're close to page 1>", ...]
}

Rules:
- Be concrete. Cite specific numbers, article titles, keyword ranks, or competitor items when making a claim.
- Each proposal must reference data from the context. No speculative proposals without supporting evidence.
- Keep proposals to 3-8 items. Quality over quantity.
- "whatWorked" and "whatDidnt" should each have 2-4 items.
- "topicGaps" and "keywordOpportunities" can be empty arrays if the data doesn't support them.
- Proposal types:
  - source: add/remove/investigate a content source
  - threshold: adjust scoring thresholds or featuring logic
  - topic: boost/deprioritize a topic area
  - keyword: add/remove/adjust a tracked keyword
  - competitor: add/remove a tracked competitor`;

const VALID_PROPOSAL_TYPES = new Set([
  'source',
  'threshold',
  'topic',
  'keyword',
  'competitor',
]);
const VALID_PROPOSAL_ACTIONS = new Set([
  'add',
  'remove',
  'adjust',
  'investigate',
]);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

export function parseConsolidationResponse(
  text: string
): ConsolidationAIResult {
  const jsonStr = extractJsonObject(text);
  const parsed = JSON.parse(jsonStr) as Partial<ConsolidationAIResult>;

  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) {
    throw new Error('Consolidation response summary is empty');
  }

  const whatWorked = parseStringArray(parsed.whatWorked);
  const whatDidnt = parseStringArray(parsed.whatDidnt);

  if (whatWorked.length === 0) {
    throw new Error('Consolidation response whatWorked is empty');
  }
  if (whatDidnt.length === 0) {
    throw new Error('Consolidation response whatDidnt is empty');
  }

  const proposals = parseProposals(parsed.proposals);
  if (proposals.length === 0) {
    throw new Error(
      'Consolidation response has zero valid proposals after filtering. ' +
        'The prompt requests 3-8; if the AI returned proposals with invalid ' +
        'type/action/confidence/priority or empty target/rationale, they were ' +
        'dropped. Check the raw AI output blob for the unfiltered response.'
    );
  }
  const topicGaps = parseStringArray(parsed.topicGaps);
  const keywordOpportunities = parseStringArray(parsed.keywordOpportunities);

  return {
    summary,
    whatWorked,
    whatDidnt,
    proposals,
    topicGaps,
    keywordOpportunities,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0
  );
}

function parseProposals(value: unknown): ConsolidationProposal[] {
  if (!Array.isArray(value)) return [];
  const result: ConsolidationProposal[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;
    const type = String(p.type ?? '');
    const action = String(p.action ?? '');
    const confidence = String(p.confidence ?? '');
    const priority = String(p.priority ?? '');
    const target = String(p.target ?? '').trim();
    const rationale = String(p.rationale ?? '').trim();
    if (
      !VALID_PROPOSAL_TYPES.has(type) ||
      !VALID_PROPOSAL_ACTIONS.has(action) ||
      !VALID_CONFIDENCE.has(confidence) ||
      !VALID_CONFIDENCE.has(priority) ||
      !target ||
      !rationale
    ) {
      continue;
    }
    result.push({
      type: type as ConsolidationProposal['type'],
      action: action as ConsolidationProposal['action'],
      target,
      rationale,
      confidence: confidence as ConsolidationProposal['confidence'],
      priority: priority as ConsolidationProposal['priority'],
    });
  }
  return result;
}
