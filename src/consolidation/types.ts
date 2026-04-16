import type { ConsolidationProposal } from '../analytics/types';

export interface ConsolidationInputRefs {
  pipelineRunIds: string[];
  snapshotIds: Record<string, string[]>;
}

export interface ConsolidationContext {
  prompt: string;
  tokenEstimate: number;
  inputRefs: ConsolidationInputRefs;
}

export interface ConsolidationAIResult {
  summary: string;
  whatWorked: string[];
  whatDidnt: string[];
  proposals: ConsolidationProposal[];
  topicGaps: string[];
  keywordOpportunities: string[];
}
