// Actual launcher with a copied fake repository and file-only child/grandchild.
// No real fixture, Sandbox, database, credentials or network is executed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment, parseArguments } from './run-midnight.mjs';

assert.deepEqual(fixtureEnvironment({ PATH:'/bin', TMPDIR:'/tmp', HOME:'/private',
  AGENTTRUST_WORKER_PRIVATE_KEY:'dummy', NODE_OPTIONS:'unsafe' }, '/sandbox', 'fixed'),
  { PATH:'/bin', TMPDIR:'/tmp', NEAR_SANDBOX_BIN_PATH:'/sandbox', AGENTTRUST_RUNTIME_COMMAND:'fixed' });
for (const args of [[], ['--user-run','--entry','/bin/sh'], ['--user-run','--sandbox-bin','/s','--wasm','relative','--output','/out'],
  ['--user-run','--sandbox-bin','/s','--wasm','/w','--wasm','/w']]) assert.throws(() => parseArguments(args));
const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'agenttrust-midnight-launcher-'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const scripts = path.join(directory, 'scripts'), binaries = path.join(directory, 'tests/runtime/target/debug');
  await mkdir(scripts, { recursive:true }); await mkdir(binaries, { recursive:true });
  const wrapper = path.join(scripts, 'run-midnight.mjs');
  await copyFile(fileURLToPath(new URL('./run-midnight.mjs', import.meta.url)), wrapper);
  const grandchild = path.join(directory, 'grandchild.mjs');
  await writeFile(grandchild, "import fs from 'node:fs';process.on('SIGTERM',()=>{});let i=0;setInterval(()=>fs.writeFileSync(process.argv[2],String(++i)),20);");
  const fixture = path.join(binaries, 'agenttrust-midnight');
  const fixtureSource = "#!" + process.execPath + "\nconst fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');const out=process.argv[6];fs.writeFileSync(out+'.group',String(process.pid));fs.writeFileSync(out+'.env',JSON.stringify(Object.keys(process.env)));spawn(process.execPath,[" + JSON.stringify(grandchild) + ",out+'.heartbeat'],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));if(path.basename(out)==='early')setTimeout(()=>process.exit(0),250);else setInterval(()=>{},1000);";
  await writeFile(fixture, fixtureSource); await chmod(fixture, 0o700);
  const sandbox = path.join(directory, 'never-executed-sandbox');
  await writeFile(sandbox, '#!/bin/sh\nexit 99\n'); await chmod(sandbox, 0o700);
  const wasm = path.join(directory, 'fixture.wasm'); await writeFile(wasm, Buffer.from([0,97,115,109]));
  const guard = path.join(directory, 'deny-network.mjs');
  await writeFile(guard, "import net from 'node:net';import tls from 'node:tls';const deny=()=>{throw Error('NETWORK_FORBIDDEN')};globalThis.fetch=deny;net.Socket.prototype.connect=deny;tls.connect=deny;if(process.argv.at(-1).endsWith('/timeout')){const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,ms===900000?500:ms,...args)}");
  for (const mode of ['SIGINT', 'SIGTERM', 'early', 'timeout']) {
    const output = path.join(directory, 'artifacts/local/runtime', mode);
    const child = spawn(process.execPath, ['--import', guard, wrapper, '--user-run', '--sandbox-bin', sandbox, '--wasm', wasm, '--output', output],
      { env:{ PATH:process.env.PATH, AGENTTRUST_SETUP_PRIVATE_KEY:'MUST_NOT_PROPAGATE', HOME:'/not-forwarded' }, stdio:'ignore' });
    const exited = new Promise((resolve, reject) => { child.once('error',reject); child.once('close',(code,signal)=>resolve({code,signal})); });
    let deadline;
    try {
      const until = Date.now()+3000;
      while (true) { try { await readFile(output+'.heartbeat'); break; } catch(error) { if(Date.now()>until)throw error; await wait(20); } }
      const env = JSON.parse(await readFile(output+'.env','utf8'));
      assert(!env.includes('AGENTTRUST_SETUP_PRIVATE_KEY') && !env.includes('HOME') && !env.includes('NODE_OPTIONS'));
      if (mode==='SIGINT' || mode==='SIGTERM') { child.kill(mode); await wait(100); child.kill(mode); }
      const result = await Promise.race([exited,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('CLEANUP_TIMEOUT')),5000);})]);
      assert.deepEqual(result,{code:mode==='SIGINT'?130:mode==='SIGTERM'?143:mode==='timeout'?124:0,signal:null});
      const stopped = await readFile(output+'.heartbeat','utf8'); await wait(120);
      assert.equal(await readFile(output+'.heartbeat','utf8'),stopped,'grandchild must stop before launcher returns');
    } finally {
      clearTimeout(deadline); child.kill('SIGKILL');
      try { const group=Number(await readFile(output+'.group','utf8'));if(Number.isSafeInteger(group)&&group>0)process.kill(-group,'SIGKILL'); }
      catch(error) { if(!['ENOENT','ESRCH'].includes(error.code))throw error; }
      await exited;
    }
  }
  console.log(JSON.stringify({parser_and_environment:'passed',repeated_sigint:'passed',repeated_sigterm:'passed',
    early_exit_cleanup:'passed',wall_timeout_cleanup:'passed',actual_fixture_or_node_execution:false}));
} finally { await rm(directory,{recursive:true,force:true}); }
