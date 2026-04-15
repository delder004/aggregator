import { describe, expect, it } from 'vitest';
import { derivePipelineStatus, deriveWorkflowStatus } from './service';
import {
  buildRunRetrospectivePrompt,
  extractJsonObject,
  parseRunRetrospectiveResponse,
} from './retrospective';
import type { PipelineRun, PipelineRunStep, RunStepReport } from '../types';

describe('run retrospective helpers', () => {
  it('extracts JSON wrapped in a fenced code block', () => {
    const json = extractJsonObject('```json\n{"summary":"ok"}\n```');
    expect(json).toBe('{"summary":"ok"}');
  });

  it('parses a structured retrospective response', () => {
    const parsed = parseRunRetrospectiveResponse(`
      {
        "summary": "The pipeline completed with one degraded step.",
        "wentWell": ["Collected 18 new articles."],
        "didntGoWell": ["The newsletter draft failed."],
        "followUps": ["Inspect the Buttondown API response."]
      }
    `);

    expect(parsed.summary).toContain('pipeline completed');
    expect(parsed.wentWell).toHaveLength(1);
    expect(parsed.didntGoWell).toHaveLength(1);
    expect(parsed.followUps).toHaveLength(1);
  });

  it('builds a prompt that includes workflow and step context', () => {
    const run: PipelineRun = {
      id: 'run-1',
      triggerType: 'manual',
      triggerSource: '/cron',
      startedAt: '2026-04-15T10:00:00.000Z',
      completedAt: '2026-04-15T10:01:00.000Z',
      status: 'warning',
      collectWorkflowId: 'collect-1',
      collectStartedAt: '2026-04-15T10:00:00.000Z',
      collectCompletedAt: '2026-04-15T10:00:30.000Z',
      collectStatus: 'complete',
      processWorkflowId: 'process-1',
      processStartedAt: '2026-04-15T10:00:00.000Z',
      processCompletedAt: '2026-04-15T10:01:00.000Z',
      processStatus: 'warning',
      retrospectiveStatus: 'pending',
      retrospectiveSummary: null,
      retrospectiveWentWell: [],
      retrospectiveDidntGoWell: [],
      retrospectiveFollowUps: [],
      retrospectiveGeneratedAt: null,
      retrospectiveError: null,
    };
    const steps: PipelineRunStep[] = [{
      pipelineRunId: 'run-1',
      workflowName: 'process',
      stepName: 'newsletter-draft',
      status: 'warning',
      startedAt: '2026-04-15T10:00:45.000Z',
      completedAt: '2026-04-15T10:01:00.000Z',
      metrics: { created: false },
      notes: ['Attempted to create a weekly draft.'],
      errors: ['Buttondown API returned 500'],
    }];

    const prompt = buildRunRetrospectivePrompt(run, steps);
    expect(prompt).toContain('Overall status: warning');
    expect(prompt).toContain('process/newsletter-draft: warning');
    expect(prompt).toContain('created=false');
    expect(prompt).toContain('Buttondown API returned 500');
  });
});

describe('run status helpers', () => {
  it('marks a workflow as warning when any step is degraded', () => {
    const steps: RunStepReport[] = [
      {
        stepName: 'score-articles',
        status: 'ok',
        startedAt: '2026-04-15T10:00:00.000Z',
        completedAt: '2026-04-15T10:00:10.000Z',
      },
      {
        stepName: 'newsletter-draft',
        status: 'warning',
        startedAt: '2026-04-15T10:00:10.000Z',
        completedAt: '2026-04-15T10:00:15.000Z',
      },
    ];

    expect(deriveWorkflowStatus(steps)).toBe('warning');
  });

  it('derives the overall pipeline status from workflow outcomes', () => {
    const run: PipelineRun = {
      id: 'run-2',
      triggerType: 'scheduled',
      triggerSource: 'cron',
      startedAt: '2026-04-15T11:00:00.000Z',
      completedAt: null,
      status: 'running',
      collectWorkflowId: 'collect-2',
      collectStartedAt: '2026-04-15T11:00:00.000Z',
      collectCompletedAt: '2026-04-15T11:00:25.000Z',
      collectStatus: 'complete',
      processWorkflowId: 'process-2',
      processStartedAt: '2026-04-15T11:00:00.000Z',
      processCompletedAt: '2026-04-15T11:00:50.000Z',
      processStatus: 'warning',
      retrospectiveStatus: 'pending',
      retrospectiveSummary: null,
      retrospectiveWentWell: [],
      retrospectiveDidntGoWell: [],
      retrospectiveFollowUps: [],
      retrospectiveGeneratedAt: null,
      retrospectiveError: null,
    };

    expect(derivePipelineStatus(run)).toBe('warning');
  });
});
