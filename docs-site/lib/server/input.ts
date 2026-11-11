import 'server-only';

import type { UIMessage } from 'ai';
import { z } from 'zod';

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
}).passthrough();

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(z.union([textPartSchema, z.object({ type: z.string() }).passthrough()])),
}).passthrough();

export const askRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
}).passthrough();

export type AskRequestBody = z.infer<typeof askRequestSchema>;

export function sanitizePromptText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function sanitizeMessages(messages: AskRequestBody['messages']): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== 'text' || typeof part.text !== 'string') return part;
      return {
        ...part,
        text: sanitizePromptText(part.text),
      };
    }),
  })) as UIMessage[];
}

export function getLatestUserPrompt(messages: UIMessage[]): string {
  const userMessage = messages.findLast((message) => message.role === 'user');
  if (!userMessage) return '';

  return userMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}
