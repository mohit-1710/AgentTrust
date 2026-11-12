import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('runtime launcher stops before any database operation',()=>{
  it('requires the explicit user-run flag',()=>{const result=spawnSync(process.execPath,['scripts/run-runtime.mjs'],{encoding:'utf8'});expect(result.status).toBe(2);expect(result.stderr).toContain('USER-RUN ONLY');expect(result.stdout).not.toContain('Starting user-run');});
  it('help does not start or install a runtime',()=>{const result=spawnSync(process.execPath,['scripts/run-runtime.mjs','--help'],{encoding:'utf8'});expect(result.status).toBe(0);expect(result.stdout).toContain('Compilation alone');expect(result.stdout).toContain('--helper-wasm');expect(result.stdout).not.toContain('Starting user-run');});
  it('rejects missing explicit binary path before spawning cargo',()=>{const result=spawnSync(process.execPath,['scripts/run-runtime.mjs','--user-run'],{encoding:'utf8'});expect(result.status).not.toBe(0);expect(result.stderr).toContain('absolute --sandbox-bin');expect(result.stdout).not.toContain('Starting user-run');});
  it('keeps runtime outside the default Rust workspace and package test commands',()=>{const root=readFileSync('Cargo.toml','utf8');expect(root).not.toContain('tests/runtime');const helper=readFileSync('tests/runtime-helper/Cargo.toml','utf8');expect(helper).toContain('[workspace]');expect(helper).toContain('test = false');expect(helper).not.toContain('unit-testing');const manifest=JSON.parse(readFileSync('package.json','utf8'));for(const name of ['test','test:unit','test:rust','check:fast','build'])expect(manifest.scripts[name]).not.toMatch(/verify:runtime|run-runtime|tests\/runtime/);});
});
