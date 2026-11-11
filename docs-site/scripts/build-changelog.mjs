#!/usr/bin/env node
/**
 * Build the docs-site changelog from upstream package CHANGELOGs.
 *
 * Sources of truth:
 *   - `mcp/CHANGELOG.md`           (Keep-a-Changelog format)
 *   - `trustgate/sdk/CHANGELOG.md` (Keep-a-Changelog format)
 *
 * Writes between the markers in `content/docs/reference/changelog.mdx`:
 *   <!-- BEGIN AUTO-GEN: changelog -->
 *   …
 *   <!-- END AUTO-GEN: changelog -->
 *
 * Runs as `prebuild` so stale sources abort the build.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = join(ROOT, '..');

const SOURCES = [
  { label: '@agenttrust-sdk/trustgate', file: 'trustgate/sdk/CHANGELOG.md' },
  { label: '@agenttrust-sdk/mcp',       file: 'mcp/CHANGELOG.md' },
];

const TARGET = join(ROOT, 'content/docs/reference/changelog.mdx');
const BEGIN = '{/* BEGIN AUTO-GEN: changelog */}';
const END = '{/* END AUTO-GEN: changelog */}';

const REPO_URL = 'https://github.com/agenttrust-labs/agenttrust';

function parseChangelog(text) {
  // Skip the H1 + intro paragraphs; collect everything from the first H2 onward.
  const lines = text.split('\n');
  const out = [];
  let started = false;
  for (const line of lines) {
    if (!started && line.startsWith('## ')) {
      started = true;
    }
    if (started) out.push(line);
  }
  return out.join('\n').trimEnd();
}

const sections = SOURCES.map(({ label, file }) => {
  const path = join(REPO_ROOT, file);
  if (!existsSync(path)) {
    throw new Error(`changelog source missing: ${path}`);
  }
  const body = parseChangelog(readFileSync(path, 'utf8'));
  // Demote H2 → H3 + H3 → H4 so they nest under the docs page's H2 group headings.
  const demoted = body.replace(/^### /gm, '#### ').replace(/^## /gm, '### ');
  const sourceLink = `[\`${file}\`](${REPO_URL}/blob/main/${file})`;
  return `## ${label}\n\nSource of truth: ${sourceLink}.\n\n${demoted}\n`;
});

const block = [
  BEGIN,
  '',
  '> Auto-generated from upstream package `CHANGELOG.md` files at build time.',
  '> If you spot drift, the `mcp/` and `trustgate/sdk/` sources are authoritative.',
  '',
  ...sections,
  END,
].join('\n');

const before = readFileSync(TARGET, 'utf8');
const beginIdx = before.indexOf(BEGIN);
const endIdx = before.indexOf(END);

let after;
if (beginIdx === -1 || endIdx === -1) {
  after = before.trimEnd() + '\n\n' + block + '\n';
} else {
  after = before.slice(0, beginIdx) + block + before.slice(endIdx + END.length);
}

writeFileSync(TARGET, after);
console.log(`✓ wrote changelog from ${SOURCES.length} sources`);
