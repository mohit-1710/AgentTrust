// Read-only checks of ordinary files. No database, provider or chain access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.dirname(docsRoot.slice(0, -1));
const activeRoot = path.join(docsRoot, 'content/docs');
const archiveRoot = path.join(docsRoot, 'archive/upstream-docs');
const read = (file) => readFile(file, 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  assert(entries.every((entry) => !entry.isSymbolicLink()), `Symlink not allowed in docs corpus: ${dir}`);
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat().sort();
}
const active = (await files(activeRoot)).filter((file) => file.endsWith('.mdx'));
const archived = (await files(archiveRoot)).filter((file) => file.endsWith('.mdx'));
assert.equal(active.length, 37);
assert.equal(archived.length, 11);
const baseline = JSON.parse(await read(path.join(repoRoot, 'docs/sprint/ui-baseline-manifest.json'))).files;
const originals = baseline.filter((entry) => entry.path.startsWith('docs-site/content/docs/') && entry.path.endsWith('.mdx'));
assert.equal(originals.length, 44);
const byRelative = new Map(archived.map((file) => [path.relative(archiveRoot, file), file]));
for (const entry of originals) {
  const relative = entry.path.slice('docs-site/content/docs/'.length);
  const archive = byRelative.get(relative);
  if (archive) {
    assert.equal(hash(await readFile(archive)), entry.sha256, `Archive byte drift: ${relative}`);
    assert(!active.includes(path.join(activeRoot, relative)), `Archived page active: ${relative}`);
  } else {
    assert(active.includes(path.join(activeRoot, relative)), `Original page unaccounted: ${relative}`);
    assert.notEqual(hash(await readFile(path.join(activeRoot, relative))), entry.sha256, `Unmigrated page: ${relative}`);
  }
}
const route = (file) => `/${path.relative(activeRoot, file).replace(/\.mdx$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/';
const routes = new Set(active.map(route));
let links = 0;
for (const file of active) {
  const text = await read(file);
  assert(!/\b(Solana|Monad|USDC|Quantu|Anchor|PDA|Dexter|Kani)\b|@agenttrust-sdk|explorer\.solana|KaniProofBadge|ProgramIdsTable/i.test(text), `Legacy claim: ${file}`);
  assert(!/^import\s|^export\s/m.test(text), `Executable corpus import: ${file}`);
  for (const match of text.matchAll(/\]\((\/[^\s)]+)\)|href="(\/[^\"]+)"/g)) {
    const href = (match[1] ?? match[2]).split('#')[0].replace(/\/$/, '') || '/';
    assert(routes.has(href), `Broken active route: ${href}`); links++;
  }
  for (const match of text.matchAll(/https:\/\/github\.com\/mohit-1710\/AgentTrust\/blob\/main\/([^\s)]+)/g)) {
    await readFile(path.join(repoRoot, match[1].split('#')[0]));
  }
}
const config = await read(path.join(docsRoot, 'source.config.ts'));
const context = await read(path.join(docsRoot, 'lib/server/docs-context.ts'));
assert(config.includes("dir: 'content/docs'"));
assert(context.includes("path.join(process.cwd(), 'content/docs')"));
assert(!context.includes('archive/'));
const generated = await read(path.join(docsRoot, '.source/server.ts'));
assert(!generated.includes('archive/'));
for (const file of active) assert(generated.includes(path.relative(docsRoot, file)), `Not in generated collection: ${file}`);
for (const dir of ['app', 'components', 'data', 'lib']) {
  for (const file of await files(path.join(docsRoot, dir))) {
    if (!/\.(tsx?|mjs)$/.test(file)) continue;
    assert(!/@agenttrust-sdk|explorer\.solana|KANI_TOTAL|KANI_HARNESSES|ProgramIdsTable|KaniProofBadge|createFromSource/.test(await read(file)), `Obsolete active source: ${file}`);
  }
}
const scripts = JSON.parse(await read(path.join(docsRoot, 'package.json'))).scripts;
assert(!scripts.prebuild && !scripts.predev && !scripts.postinstall, 'Implicit docs lifecycle hook');
console.log(`Corpus checked: ${originals.length} originals, ${active.length} active routes, ${archived.length} exact archives, ${links} local links; collection/assistant/archive boundary intact.`);
