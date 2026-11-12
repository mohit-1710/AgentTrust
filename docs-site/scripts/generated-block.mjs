import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const repoRoot = new URL('../../', import.meta.url);
export const sourceHash = (text) => createHash('sha256').update(text).digest('hex');

// Generators only replace their explicit block in a tracked native page.
export async function writeBlock(relativePath, name, body) {
  const file = new URL(`../content/docs/${relativePath}`, import.meta.url);
  const text = await readFile(file, 'utf8');
  const begin = `{/* BEGIN AUTO-GEN: ${name} */}`;
  const end = `{/* END AUTO-GEN: ${name} */}`;
  if (text.split(begin).length !== 2 || text.split(end).length !== 2 || text.indexOf(end) < text.indexOf(begin)) {
    throw new Error(`Expected one ordered ${name} block in ${relativePath}`);
  }
  const next = `${text.slice(0, text.indexOf(begin))}${begin}\n\n${body}\n\n${text.slice(text.indexOf(end))}`;
  if (process.argv.includes('--check')) {
    if (next !== text) throw new Error(`Stale generated block: ${relativePath}. Run pnpm --filter docs-site generate.`);
  } else if (next !== text) {
    await writeFile(file, next);
  }
  console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${relativePath}`);
}
