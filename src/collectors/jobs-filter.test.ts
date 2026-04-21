import { describe, it, expect } from 'vitest';
import {
  isAccountingFocusedCompany,
  isAccountingRelevantRole,
} from './jobs-filter';

describe('isAccountingFocusedCompany', () => {
  it('accepts seed companies whose description names accounting', () => {
    expect(
      isAccountingFocusedCompany({
        name: 'Vic.ai',
        description: 'AI-powered autonomous accounting platform',
      })
    ).toBe(true);
    expect(
      isAccountingFocusedCompany({
        name: 'Truewind',
        description: 'AI-powered bookkeeping and finance for startups',
      })
    ).toBe(true);
    expect(
      isAccountingFocusedCompany({
        name: 'Stampli',
        description: 'AI-powered accounts payable automation',
      })
    ).toBe(true);
  });

  it('rejects horizontal AI labs that get auto-discovered', () => {
    expect(
      isAccountingFocusedCompany({
        name: 'Anthropic',
        description: 'AI safety company building large language models',
      })
    ).toBe(false);
    expect(
      isAccountingFocusedCompany({
        name: 'OpenAI',
        description: null,
      })
    ).toBe(false);
    expect(
      isAccountingFocusedCompany({
        name: 'Perplexity',
        description: 'AI-powered answer engine',
      })
    ).toBe(false);
  });

  it('accepts AI-fintech spend/payables/expense platforms', () => {
    expect(
      isAccountingFocusedCompany({
        name: 'Brex',
        description: 'AI-powered spend platform for businesses',
      })
    ).toBe(true);
    expect(
      isAccountingFocusedCompany({
        name: 'Ramp',
        description: 'Corporate card and spend management platform with AI',
      })
    ).toBe(true);
    expect(
      isAccountingFocusedCompany({
        name: 'Tipalti',
        description: 'Global payables automation platform',
      })
    ).toBe(true);
  });

  it('handles null description without throwing', () => {
    expect(
      isAccountingFocusedCompany({ name: 'Intuit', description: null })
    ).toBe(false);
  });

  it('matches on the company name alone', () => {
    expect(
      isAccountingFocusedCompany({
        name: 'Acme Accounting',
        description: null,
      })
    ).toBe(true);
  });
});

describe('isAccountingRelevantRole', () => {
  it('keeps explicit accounting/finance roles', () => {
    expect(isAccountingRelevantRole('Senior Accountant', 'Finance')).toBe(true);
    expect(isAccountingRelevantRole('Tax Analyst', null)).toBe(true);
    expect(isAccountingRelevantRole('Controller', null)).toBe(true);
    expect(isAccountingRelevantRole('Payroll Specialist', 'Operations')).toBe(true);
    expect(isAccountingRelevantRole('FP&A Manager', null)).toBe(true);
    expect(isAccountingRelevantRole('Software Engineer', 'Finance')).toBe(true);
  });

  it('drops generic Anthropic-style roles', () => {
    expect(isAccountingRelevantRole('Software Engineer', 'Research')).toBe(false);
    expect(isAccountingRelevantRole('Product Manager', null)).toBe(false);
    expect(isAccountingRelevantRole('Member of Technical Staff', 'Model Training')).toBe(false);
    expect(isAccountingRelevantRole('Recruiter', 'People')).toBe(false);
  });

  it('does not false-positive on lookalike substrings', () => {
    // "Account Executive" is sales, not accounting; "account" alone is not a keyword.
    expect(isAccountingRelevantRole('Account Executive', 'Sales')).toBe(false);
    // "Taxonomy Engineer" contains "tax" as substring but not as a word.
    expect(isAccountingRelevantRole('Taxonomy Engineer', null)).toBe(false);
  });

  it('handles null department', () => {
    expect(isAccountingRelevantRole('Staff Accountant', null)).toBe(true);
    expect(isAccountingRelevantRole('Designer', null)).toBe(false);
  });
});
