#!/usr/bin/env node
/**
 * Probe the Ask AI widget at POST /api/ask with three sample queries.
 *
 * Records the response (or failure mode) so the final report can flag
 * whether the widget is live or quota-blocked.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.SWEEP_BASE_URL || 'http://localhost:3001';
const OUT = process.env.AI_PROBE_OUT || '/tmp/docs-r/ai-widget-probe.json';

const QUERIES = [
  'What is the atomic-tx invariant?',
  'How many Kani proofs does AgentTrust ship?',
  'What does DenyReason code 6 mean?',
];

mkdirSync('/tmp/docs-r', { recursive: true });

const results = [];

for (const query of QUERIES) {
  const start = Date.now();
  let status = null;
  let body = '';
  let bytes = 0;
  let firstByteMs = null;
  let totalMs = null;

  try {
    const resp = await fetch(`${BASE}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: `probe-${Date.now()}`,
            role: 'user',
            parts: [{ type: 'text', text: query }],
          },
        ],
      }),
    });
    status = resp.status;
    if (resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstByteMs === null) firstByteMs = Date.now() - start;
        bytes += value.length;
        body += decoder.decode(value, { stream: true });
        if (body.length > 4_000) break;
      }
    } else {
      body = await resp.text();
      bytes = body.length;
    }
    totalMs = Date.now() - start;
  } catch (err) {
    body = `fetch error: ${err.message}`;
    totalMs = Date.now() - start;
  }

  results.push({
    query,
    status,
    firstByteMs,
    totalMs,
    bytes,
    bodyExcerpt: body.slice(0, 600),
  });

  console.log(
    `[${status === 200 ? '✓' : '✗'}] "${query.slice(0, 50)}" status=${status} firstByte=${firstByteMs}ms total=${totalMs}ms bytes=${bytes}`,
  );
}

writeFileSync(OUT, JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), results }, null, 2));
console.log(`Saved probe to ${OUT}`);

const allOk = results.every((r) => r.status === 200);
process.exit(allOk ? 0 : 1);
