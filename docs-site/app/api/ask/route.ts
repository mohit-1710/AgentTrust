import { convertToModelMessages, smoothStream, streamText } from 'ai';
import { buildDocsAssistantPrompt } from '@/lib/server/docs-context';
import {
  askRequestSchema,
  getLatestUserPrompt,
  sanitizeMessages,
} from '@/lib/server/input';
import { createAskAiProvider, MissingAskAiKeyError } from '@/lib/server/ask-ai-provider';
import { checkRateLimit, hashIp, ipFromRequest } from '@/lib/server/ratelimit';

export const runtime = 'nodejs';

const MAX_PROMPT_CHARS = 500;

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });
}

function errorResponse(message: string, init: ResponseInit): Response {
  return new Response(message, {
    ...init,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...init.headers,
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const ipHash = hashIp(ipFromRequest(req));
  const limit = checkRateLimit(ipHash);
  if (!limit.allowed) {
    return errorResponse(
      'Too many questions. Try again in a minute.',
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    );
  }

  const body = askRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return errorResponse('Invalid Ask AI request.', { status: 400 });
  }

  const messages = sanitizeMessages(body.data.messages);
  const latestPrompt = getLatestUserPrompt(messages);
  if (!latestPrompt || latestPrompt.length > MAX_PROMPT_CHARS) {
    return errorResponse('Ask AI questions must be 1 to 500 characters.', { status: 400 });
  }

  try {
    const provider = createAskAiProvider();
    const result = streamText({
      model: provider.model,
      messages: [
        provider.systemMessage(await buildDocsAssistantPrompt()),
        ...(await convertToModelMessages(messages)),
      ],
      temperature: 0.2,
      experimental_transform: smoothStream({ chunking: 'word' }),
      ...provider.callOptions,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof MissingAskAiKeyError) {
      return errorResponse('Ask AI is not configured for this deployment.', { status: 503 });
    }
    return errorResponse('Ask AI failed. Try again shortly.', { status: 500 });
  }
}
