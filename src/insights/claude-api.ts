/**
 * Shared Claude API client for insight generators.
 */

import type { Env } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * Call the Claude API with a system prompt and user message.
 * Returns the text content of the response.
 */
export async function callClaudeAPI(
  systemPrompt: string,
  userMessage: string,
  env: Env,
  maxTokens: number = 1024,
): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content?.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  return textBlock.text;
}

/**
 * Call the Claude API with an explicit model override.
 * Used by Phase 2 consolidation (Sonnet) while the default callClaudeAPI
 * stays on Haiku for retrospectives and scoring.
 */
export async function callClaudeAPIWithModel(
  model: string,
  systemPrompt: string,
  userMessage: string,
  env: Env,
  maxTokens: number = 2048,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const body = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const textBlock = data.content?.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  return {
    text: textBlock.text,
    usage: {
      inputTokens: Number(data.usage?.input_tokens ?? 0),
      outputTokens: Number(data.usage?.output_tokens ?? 0),
    },
  };
}
