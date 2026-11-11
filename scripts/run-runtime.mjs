// USER-RUN ONLY. This launcher starts a process that creates a Sandbox database.
import { access, realpath, stat, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const usage = `USER-RUN ONLY: creates a local NEAR Sandbox database and test accounts.
Usage: pnpm verify:runtime -- --user-run --sandbox-bin /absolute/near-sandbox
       [--wasm target/wasm32-unknown-unknown/release/agenttrust_core.wasm]
       [--fault-wasm target/runtime-fault/wasm32-unknown-unknown/release/agenttrust_core.wasm]
       [--output artifacts/local/runtime/<new-directory>]
No binary download, remote deployment or real account key is used.
Exit 0: every required case reported passed; 1: failure; 2: incomplete evidence.
Compilation alone: pnpm check:runtime:compile (does not start Sandbox).`;
const args = process.argv.slice(2).filter(arg => arg !== '--');
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
if (args[0] !== '--user-run') { console.error(usage); process.exit(2); }
const values = new Map();
for (let index = 1; index < args.length; index += 2) {
  const key = args[index]; const value = args[index + 1];
  if (!['--sandbox-bin','--wasm','--fault-wasm','--output'].includes(key) || !value || value.startsWith('--') || values.has(key)) throw new Error('Invalid or duplicate runtime argument');
  values.set(key,value);
}
if (!values.has('--sandbox-bin') || !path.isAbsolute(values.get('--sandbox-bin'))) throw new Error('An existing absolute --sandbox-bin is required; automatic installation is disabled');
const root = await realpath(process.cwd());
await access(path.join(root,'docs/sprint/architecture.md'));
const sandbox = await realpath(values.get('--sandbox-bin'));
await access(sandbox,constants.X_OK);
if (!(await stat(sandbox)).isFile()) throw new Error('Sandbox binary must be a regular executable file');
const production = await realpath(path.resolve(values.get('--wasm') ?? 'target/wasm32-unknown-unknown/release/agenttrust_core.wasm'));
const fault = values.has('--fault-wasm') ? await realpath(path.resolve(values.get('--fault-wasm'))) : undefined;
if (fault === production) throw new Error('Fault and production WASM must be separate artifacts');
const output = path.resolve(values.get('--output') ?? `artifacts/local/runtime/${new Date().toISOString().replaceAll(':','-')}`);
if (!output.startsWith(path.join(root,'artifacts/local/runtime')+path.sep)) throw new Error('Output must stay below ignored artifacts/local/runtime/');
for (let current = path.dirname(output); current !== root; current = path.dirname(current)) {
  try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Output parent cannot be a symbolic link'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
try { await access(output); throw new Error('Output already exists; recorded evidence is never overwritten'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const binaryArgs = ['run','--locked','--manifest-path','tests/runtime/Cargo.toml','--','--user-run',production,output];
if (fault) binaryArgs.push(fault);
console.log('Starting user-run Sandbox; no runtime success is implied until the evidence is inspected.');
const child = spawnSync('cargo',binaryArgs,{stdio:'inherit',env:{...process.env,NEAR_SANDBOX_BIN_PATH:sandbox,AGENTTRUST_RUNTIME_COMMAND:`pnpm verify:runtime ${args.map(arg=>JSON.stringify(arg)).join(' ')}`}});
if (child.error) throw child.error;
process.exit(child.status ?? 1);
