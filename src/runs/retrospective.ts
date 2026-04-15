import type { Env, PipelineRun, PipelineRunRetrospective, PipelineRunStep } from '../types';
import { callClaudeAPI } from '../insights/claude-api';

const SYSTEM_PROMPT = `You are an operations analyst reviewing an automated content pipeline.

You will receive structured facts about one pipeline run. Summarize only what is supported by those facts.

Return valid JSON only with this exact schema:
{
  "summary": "<1-2 sentence overview>",
  "wentWell": ["<item>", "<item>"],
  "didntGoWell": ["<item>", "<item>"],
  "followUps": ["<item>", "<item>"]
}

Rules:
- Be concrete and concise.
- Mention specific step names, counts, and recorded errors when relevant.
- Do not invent root causes, fixes, or business impact.
- If no real issues were recorded, say so explicitly in "didntGoWell".
- Keep each list to 1-4 items.`;

interface RetrospectiveResponse {
  summary: string;
  wentWell: string[];
  didntGoWell: string[];
  followUps: string[];
}

export function buildRunRetrospectivePrompt(
  run: PipelineRun,
  steps: PipelineRunStep[]
): string {
  const lines: string[] = [
    `Run ID: ${run.id}`,
    `Trigger: ${run.triggerType} (${run.triggerSource})`,
    `Started: ${run.startedAt}`,
    `Completed: ${run.completedAt ?? 'not completed'}`,
    `Overall status: ${run.status}`,
    `Collect workflow: ${run.collectStatus}`,
    `Process workflow: ${run.processStatus}`,
    '',
    'Steps:',
  ];

  for (const step of steps) {
    const metricEntries = Object.entries(step.metrics)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');
    lines.push(`- ${step.workflowName}/${step.stepName}: ${step.status}`);
    if (metricEntries) {
      lines.push(`  metrics: ${metricEntries}`);
    }
    if (step.notes.length > 0) {
      lines.push(`  notes: ${step.notes.join(' | ')}`);
    }
    if (step.errors.length > 0) {
      lines.push(`  errors: ${step.errors.join(' | ')}`);
    }
  }

  return lines.join('\n');
}

export function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in retrospective response');
  }
  return trimmed.slice(start, end + 1);
}

export function parseRunRetrospectiveResponse(text: string): RetrospectiveResponse {
  const parsed = JSON.parse(extractJsonObject(text)) as Partial<RetrospectiveResponse>;
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const wentWell = Array.isArray(parsed.wentWell)
    ? parsed.wentWell.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const didntGoWell = Array.isArray(parsed.didntGoWell)
    ? parsed.didntGoWell.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const followUps = Array.isArray(parsed.followUps)
    ? parsed.followUps.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  if (!summary) {
    throw new Error('Run retrospective summary is empty');
  }
  if (wentWell.length === 0) {
    throw new Error('Run retrospective wentWell is empty');
  }
  if (didntGoWell.length === 0) {
    throw new Error('Run retrospective didntGoWell is empty');
  }
  if (followUps.length === 0) {
    throw new Error('Run retrospective followUps is empty');
  }

  return { summary, wentWell, didntGoWell, followUps };
}

export async function generateRunRetrospective(
  run: PipelineRun,
  steps: PipelineRunStep[],
  env: Env
): Promise<PipelineRunRetrospective> {
  const response = await callClaudeAPI(
    SYSTEM_PROMPT,
    buildRunRetrospectivePrompt(run, steps),
    env,
    700
  );
  const parsed = parseRunRetrospectiveResponse(response);
  return {
    summary: parsed.summary,
    wentWell: parsed.wentWell,
    didntGoWell: parsed.didntGoWell,
    followUps: parsed.followUps,
    generatedAt: new Date().toISOString(),
  };
}
