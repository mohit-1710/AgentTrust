// Reads the native profile validator; writes only the supported-capability block.
import { readFile } from 'node:fs/promises';
import { repoRoot, sourceHash, writeBlock } from './generated-block.mjs';

const sourcePath = 'crates/agenttrust-domain/src/owner.rs';
const source = await readFile(new URL(sourcePath, repoRoot), 'utf8');
const namespace = source.match(/self\.capability_namespace != "([a-z.]+)"/)?.[1];
const version = source.match(/self\.capability_version != (\d+)/)?.[1];
const issuers = source.match(/pub const MAX_ACCEPTED_ISSUERS: usize = (\d+);/)?.[1];
if (!namespace || !version || !issuers) throw new Error('Native capability validator changed; review its documentation generator.');

await writeBlock('reference/capability-namespaces.mdx', 'namespaces', [
  '| Capability | Namespace field | Version field | Accepted issuers |',
  '|---|---|---:|---|',
  `| \`${namespace}.v${version}\` | \`${namespace}\` | ${version} | 1–${issuers} unique accounts per required profile |`,
  '',
  `Generated from the [native profile validator](https://github.com/mohit-1710/AgentTrust/blob/main/${sourcePath}). Source SHA-256: \`${sourceHash(source)}\`.`,
].join('\n'));
