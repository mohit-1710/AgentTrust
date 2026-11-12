// The ledger is authoritative: only explicit "TNN done" entries enter this table.
// Preparation/review lines never become accepted milestones through code existence.
import { readFile } from 'node:fs/promises';
import { repoRoot, sourceHash, writeBlock } from './generated-block.mjs';

const sourcePath = 'docs/sprint/ledger.md';
const ledger = await readFile(new URL(sourcePath, repoRoot), 'utf8');
const entries = [...ledger.matchAll(/^(T\d{2}) done [^|\n]+\| ([^|\n]+)/gm)];
if (!entries.length || new Set(entries.map((entry) => entry[1])).size !== entries.length) {
  throw new Error('Expected unique accepted task entries in the sprint ledger.');
}
const escape = (text) => text.trim().replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');
await writeBlock('reference/changelog.mdx', 'changelog', [
  '| Milestone | Recorded local acceptance |',
  '|---|---|',
  ...entries.map((entry) => `| ${entry[1]} | ${escape(entry[2])} |`),
  '',
  `Generated from explicit accepted-task entries in the [sprint ledger](https://github.com/mohit-1710/AgentTrust/blob/main/${sourcePath}). Source SHA-256: \`${sourceHash(ledger)}\`.`,
  '',
  'The table records accepted milestones. Local checks, native execution, public hosting and useful paid output have separate evidence gates.',
].join('\n'));
