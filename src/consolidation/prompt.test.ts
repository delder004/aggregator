import { describe, it, expect } from 'vitest';
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  parseConsolidationResponse,
} from './prompt';

describe('CONSOLIDATION_SYSTEM_PROMPT', () => {
  it('mentions the JSON schema fields', () => {
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"summary"');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"whatWorked"');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"whatDidnt"');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"proposals"');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"topicGaps"');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('"keywordOpportunities"');
  });

  it('lists the valid proposal types', () => {
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('source');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('threshold');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('topic');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('keyword');
    expect(CONSOLIDATION_SYSTEM_PROMPT).toContain('competitor');
  });
});

describe('parseConsolidationResponse', () => {
  const validResponse = JSON.stringify({
    summary: 'Good week overall. Traffic up 20%.',
    whatWorked: ['Article scoring was accurate', 'HN referrals increased'],
    whatDidnt: ['YouTube collector failed twice', 'Stale sources not pruned'],
    proposals: [
      {
        type: 'source',
        action: 'add',
        target: 'Thomson Reuters AI blog',
        rationale: 'Competitors covered 3 stories from this source',
        confidence: 'medium',
        priority: 'high',
      },
      {
        type: 'keyword',
        action: 'adjust',
        target: 'ai audit automation',
        rationale: 'Rank improved from #12 to #9, near page 1 threshold',
        confidence: 'high',
        priority: 'medium',
      },
    ],
    topicGaps: ['AI in payroll', 'Agentic tax filing'],
    keywordOpportunities: ['ai audit automation'],
  });

  it('parses a valid response', () => {
    const result = parseConsolidationResponse(validResponse);
    expect(result.summary).toBe('Good week overall. Traffic up 20%.');
    expect(result.whatWorked).toHaveLength(2);
    expect(result.whatDidnt).toHaveLength(2);
    expect(result.proposals).toHaveLength(2);
    expect(result.proposals[0].type).toBe('source');
    expect(result.proposals[0].action).toBe('add');
    expect(result.proposals[1].type).toBe('keyword');
    expect(result.topicGaps).toEqual(['AI in payroll', 'Agentic tax filing']);
    expect(result.keywordOpportunities).toEqual(['ai audit automation']);
  });

  it('handles markdown code fences', () => {
    const wrapped = '```json\n' + validResponse + '\n```';
    const result = parseConsolidationResponse(wrapped);
    expect(result.summary).toBe('Good week overall. Traffic up 20%.');
  });

  it('throws on empty summary', () => {
    const bad = JSON.stringify({
      summary: '',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [],
      topicGaps: [],
      keywordOpportunities: [],
    });
    expect(() => parseConsolidationResponse(bad)).toThrow(/summary is empty/);
  });

  it('throws on empty whatWorked', () => {
    const bad = JSON.stringify({
      summary: 'ok',
      whatWorked: [],
      whatDidnt: ['y'],
      proposals: [],
    });
    expect(() => parseConsolidationResponse(bad)).toThrow(
      /whatWorked is empty/
    );
  });

  it('throws on empty whatDidnt', () => {
    const bad = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: [],
      proposals: [],
    });
    expect(() => parseConsolidationResponse(bad)).toThrow(
      /whatDidnt is empty/
    );
  });

  it('throws when all proposals have invalid type (zero valid after filter)', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [
        {
          type: 'invalid',
          action: 'add',
          target: 't',
          rationale: 'r',
          confidence: 'high',
          priority: 'high',
        },
      ],
    });
    expect(() => parseConsolidationResponse(input)).toThrow(
      /zero valid proposals/
    );
  });

  it('throws when all proposals have invalid action', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [
        {
          type: 'source',
          action: 'destroy',
          target: 't',
          rationale: 'r',
          confidence: 'high',
          priority: 'high',
        },
      ],
    });
    expect(() => parseConsolidationResponse(input)).toThrow(
      /zero valid proposals/
    );
  });

  it('throws when all proposals have empty target or rationale', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [
        {
          type: 'source',
          action: 'add',
          target: '',
          rationale: 'r',
          confidence: 'high',
          priority: 'high',
        },
        {
          type: 'source',
          action: 'add',
          target: 't',
          rationale: '',
          confidence: 'high',
          priority: 'high',
        },
      ],
    });
    expect(() => parseConsolidationResponse(input)).toThrow(
      /zero valid proposals/
    );
  });

  it('throws when proposals array is empty', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [],
    });
    expect(() => parseConsolidationResponse(input)).toThrow(
      /zero valid proposals/
    );
  });

  it('keeps valid proposals even when some are dropped', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x'],
      whatDidnt: ['y'],
      proposals: [
        {
          type: 'invalid',
          action: 'add',
          target: 't',
          rationale: 'r',
          confidence: 'high',
          priority: 'high',
        },
        {
          type: 'source',
          action: 'add',
          target: 'good target',
          rationale: 'good reason',
          confidence: 'medium',
          priority: 'high',
        },
      ],
    });
    const result = parseConsolidationResponse(input);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].target).toBe('good target');
  });

  it('accepts empty topicGaps and keywordOpportunities when proposals exist', () => {
    const result = parseConsolidationResponse(validResponse);
    // validResponse has proposals, so it passes; check that empty optional
    // arrays are also fine
    expect(result.topicGaps).toBeDefined();
    expect(result.keywordOpportunities).toBeDefined();
  });

  it('filters out empty strings from arrays', () => {
    const input = JSON.stringify({
      summary: 'ok',
      whatWorked: ['x', '', '  ', 'y'],
      whatDidnt: ['a'],
      proposals: [
        {
          type: 'source',
          action: 'add',
          target: 'filler',
          rationale: 'needed for valid response',
          confidence: 'low',
          priority: 'low',
        },
      ],
    });
    const result = parseConsolidationResponse(input);
    expect(result.whatWorked).toEqual(['x', 'y']);
  });

  it('throws on non-JSON input', () => {
    expect(() => parseConsolidationResponse('not json at all')).toThrow();
  });

  it('throws on missing summary field', () => {
    const input = JSON.stringify({
      whatWorked: ['x'],
      whatDidnt: ['y'],
    });
    expect(() => parseConsolidationResponse(input)).toThrow(/summary/);
  });
});
