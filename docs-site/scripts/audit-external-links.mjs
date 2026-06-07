#!/usr/bin/env node
/**
 * Walk every MDX page in `content/docs/`, extract external links
 * (Solana Explorer, npm, GitHub, Fly endpoints, agenttrust.tech),
 * probe each with HEAD (falling back to GET on 405), record the status.
 *
 * Saves a JSON summary to `/tmp/docs-r/external-links.json`.
 * Exits non-zero if any link returns a non-2xx (or non-3xx-redirect-to-2xx).
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'content/docs');
const OUT = '/tmp/docs-r/external-links.json';
mkdirSync('/tmp/docs-r', { recursive: true });

const ALLOWED_HOSTS = [
  'explorer.solana.com',
  'www.npmjs.com',
  'github.com',
  'raw.githubusercontent.com',
  'agenttrust.tech',
  'docs.agenttrust.tech',
  'demo.agenttrust.tech',
  'api.agenttrust.tech',
  'mcp.agenttrust.tech',
  'solana.com',
  'docs.helius.dev',
];

function findMdx(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...findMdx(abs));
    else if (abs.endsWith('.mdx')) out.push(abs);
  }
  return out;
}

const files = findMdx(CONTENT);
const linkSet = new Set();

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  // Match Markdown-style links [text](https://…) plus bare URLs in code blocks/tables
  const md = text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g);
  for (const m of md) linkSet.add(m[1]);
  // Bare URLs (very loose)
  const bare = text.matchAll(/https?:\/\/[^\s)>"`'\]]+/g);
  for (const m of bare) linkSet.add(m[0]);
}

const links = [...linkSet]
  .map((u) => u.replace(/[).,;:]+$/, ''))
  .filter((u) => {
    try {
      const url = new URL(u);
      return ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  })
  .sort();

console.log(`Found ${links.length} unique external links across ${files.length} MDX files.`);

async function probe(url) {
  // HEAD first; if 405 / 403, retry with GET.
  const start = Date.now();
  try {
    let resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (resp.status === 405 || resp.status === 403) {
      resp = await fetch(url, { method: 'GET', redirect: 'follow' });
      // Drain the body to release the socket.
      try { await resp.text(); } catch {}
    }
    return { url, status: resp.status, ms: Date.now() - start };
  } catch (err) {
    return { url, status: 0, ms: Date.now() - start, error: err.message };
  }
}

const results = [];
const CONCURRENCY = 6;
let i = 0;

async function worker() {
  while (i < links.length) {
    const url = links[i++];
    const result = await probe(url);
    results.push(result);
    const ok = result.status >= 200 && result.status < 400;
    console.log(`[${ok ? '✓' : '✗'}] ${result.status.toString().padEnd(3)} ${result.url}${result.error ? ` ${result.error}` : ''}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

results.sort((a, b) => a.url.localeCompare(b.url));
const failures = results.filter((r) => !(r.status >= 200 && r.status < 400));

writeFileSync(OUT, JSON.stringify({ totalLinks: links.length, results, failures }, null, 2));
console.log(`\n${links.length} links probed; ${failures.length} failures. Saved to ${OUT}.`);

process.exit(failures.length === 0 ? 0 : 1);
