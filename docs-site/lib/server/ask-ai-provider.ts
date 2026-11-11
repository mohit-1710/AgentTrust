import 'server-only';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel, ModelMessage } from 'ai';

export const ANTHROPIC_MODEL = 'claude-haiku-4-5';
export const OPENAI_MODEL = 'gpt-4.1-mini';

export class MissingAskAiKeyError extends Error {
  constructor() {
    super('No Ask-AI provider key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    this.name = 'MissingAskAiKeyError';
  }
}

export interface AskAiProvider {
  model: LanguageModel;
  /** Wraps the docs system prompt with the provider's prompt-cache hint. */
  systemMessage(prompt: string): ModelMessage;
  /** Extra streamText options the provider needs (e.g. OpenAI cache key). */
  callOptions: Record<string, unknown>;
}

function anthropicProvider(apiKey: string): AskAiProvider {
  const provider = createAnthropic({ apiKey });
  return {
    model: provider(ANTHROPIC_MODEL),
    systemMessage(prompt) {
      return {
        role: 'system',
        content: prompt,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      };
    },
    callOptions: {},
  };
}

function openaiProvider(apiKey: string): AskAiProvider {
  const provider = createOpenAI({ apiKey });
  return {
    model: provider(OPENAI_MODEL),
    systemMessage(prompt) {
      return { role: 'system', content: prompt };
    },
    callOptions: {
      providerOptions: { openai: { promptCacheKey: 'docs-assistant-v1' } },
    },
  };
}

/**
 * Resolves the Ask-AI provider. Anthropic is the default when ANTHROPIC_API_KEY
 * is set; OpenAI is used only as a fallback when no Anthropic key is present.
 */
export function createAskAiProvider(): AskAiProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return anthropicProvider(anthropicKey);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return openaiProvider(openaiKey);

  throw new MissingAskAiKeyError();
}
