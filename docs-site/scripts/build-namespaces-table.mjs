#!/usr/bin/env node
/**
 * Generate the v1 capability namespaces table from
 * `examples/attestor-demo/devnet-namespaces.json`.
 *
 * Writes between the markers:
 *   <!-- BEGIN AUTO-GEN: namespaces -->
 *   …
 *   <!-- END AUTO-GEN: namespaces -->
 *
 * In `content/docs/reference/capability-namespaces.mdx`.
 *
 * Runs as `prebuild` so a stale source aborts the build.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = join(ROOT, '..');

const SOURCE = join(REPO_ROOT, 'examples/attestor-demo/devnet-namespaces.json');
const TARGET = join(ROOT, 'content/docs/reference/capability-namespaces.mdx');

const BEGIN = '{/* BEGIN AUTO-GEN: namespaces */}';
const END = '{/* END AUTO-GEN: namespaces */}';

if (!existsSync(SOURCE)) {
  console.error(`✗ source missing: ${SOURCE}`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(SOURCE, 'utf8'));
const { network, program, capturedAt, namespaceCount, namespaces } = data;

const rows = namespaces
  .map((ns) => {
    const shortHash = ns.capabilityHash.slice(0, 12) + '…';
    const hashCell = ns.signatureExplorer
      ? `[\`${shortHash}\`](${ns.signatureExplorer})`
      : `\`${shortHash}\``;
    const pdaCell = ns.pdaExplorer
      ? `[\`${ns.pda.slice(0, 10)}…\`](${ns.pdaExplorer})`
      : `\`${ns.pda.slice(0, 10)}…\``;
    const status = ns.status ? ` _(${ns.status})_` : '';
    return `| \`${ns.name}\` | ${ns.description.replace(/\|/g, '\\|')}${status} | ${hashCell} | ${pdaCell} |`;
  })
  .join('\n');

const block = [
  BEGIN,
  '',
  `> Auto-generated from \`examples/attestor-demo/devnet-namespaces.json\` on ${capturedAt}.`,
  `> Network: \`${network}\`. Program: \`${program}\`. Count: ${namespaceCount}.`,
  '',
  '| Name | Description | Capability hash (SHA-256, prefix) | PDA |',
  '|---|---|---|---|',
  rows,
  '',
  '> Names are bounded by `MAX_NAME_LEN = 32` per [`programs/validation-registry/src/instructions/register_namespace.rs`](https://github.com/agenttrust-labs/agenttrust/blob/main/programs/validation-registry/src/instructions/register_namespace.rs). PDA seeds: `["capability", capability_hash]`.',
  '',
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
console.log(`✓ wrote ${namespaceCount} namespaces to capability-namespaces.mdx`);
