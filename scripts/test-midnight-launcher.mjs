// Actual launcher with a copied fake repository and file-only child/grandchild.
// No real fixture, Sandbox, database, credentials or network is executed.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { appendFile, chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment, observeGroupDisappearance, parseArguments } from './run-midnight.mjs';

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
  await copyFile(fileURLToPath(new URL('../.node-version', import.meta.url)), path.join(directory, '.node-version'));
  const grandchild = path.join(directory, 'grandchild.mjs');
  await writeFile(grandchild, "import fs from 'node:fs';process.on('SIGTERM',()=>{});let i=0;setInterval(()=>fs.writeFileSync(process.argv[2],String(++i)),20);");
  const fixture = path.join(binaries, 'agenttrust-midnight');
  const rustSource = path.join(directory, 'exit.rs'), rustFixture = path.join(directory, 'rust-exit');
  await writeFile(rustSource, 'unsafe extern "C"{fn fork()->i32;fn setpgid(pid:i32,pgid:i32)->i32;fn waitpid(pid:i32,status:*mut i32,options:i32)->i32;}fn main(){let out=std::env::args().last().unwrap();if out=="zombie-controller"{let pid=unsafe{fork()};assert!(pid>=0);if pid==0{assert_eq!(unsafe{setpgid(0,0)},0);std::process::exit(0)}std::thread::sleep(std::time::Duration::from_millis(150));println!("{}",pid);let mut line=String::new();std::io::stdin().read_line(&mut line).unwrap();let mut status=0;assert_eq!(unsafe{waitpid(pid,&mut status,0)},pid);return}std::fs::write(format!("{}.group",out),std::process::id().to_string()).unwrap();std::fs::write(format!("{}.env",out),"[]").unwrap();println!("ordinary Rust exit stub");std::process::exit(if out.ends_with("nonzero"){7}else{0});}');
  execFileSync('rustc', ['--edition=2024', rustSource, '-o', rustFixture], { stdio:'pipe' });
  if (process.platform==='darwin') {
    const controller=spawn(rustFixture,['zombie-controller'],{stdio:['pipe','pipe','pipe']});
    const exited=new Promise((resolve,reject)=>{controller.once('error',reject);controller.once('close',code=>resolve(code));});
    let startupTimer;
    try {
      const line=await Promise.race([new Promise(resolve=>controller.stdout.once('data',chunk=>resolve(String(chunk)))),new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(Error('ZOMBIE_STARTUP_TIMEOUT')),3000);})]);
      clearTimeout(startupTimer);
      assert.match(line,/^\d+\n$/);const pid=Number(line.trim());
      const fields=execFileSync('ps',['-p',String(pid),'-o','ppid=,pgid=,stat='],{encoding:'utf8'}).trim().split(/\s+/);
      assert.equal(Number(fields[0]),controller.pid);assert.equal(Number(fields[1]),pid);assert.match(fields[2],/^Z/);
      assert.throws(()=>process.kill(-pid,0),{code:'EPERM'});
      assert.equal(await observeGroupDisappearance(pid,Date.now()+100),false,'unreaped EPERM stays unresolved');
      const disappeared=observeGroupDisappearance(pid,Date.now()+2000);
      await wait(100);controller.stdin.end('reap\n');
      assert.equal(await disappeared,true,'only reaping and observed ESRCH establish disappearance');
      assert.equal(await exited,0);
      assert.throws(()=>process.kill(-pid,0),{code:'ESRCH'});
    } finally {
      clearTimeout(startupTimer);
      if (!controller.stdin.writableEnded) controller.stdin.end('reap\n');
      await exited;
    }
  }
  const fixtureSource = "#!" + process.execPath + "\nconst fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');const out=process.argv[6],mode=path.basename(out);fs.writeFileSync(out+'.group',String(process.pid));fs.writeFileSync(out+'.env',JSON.stringify(Object.keys(process.env)));if(['transient-eperm','unrelated-error'].includes(mode))process.exit(0);if(['nonzero','cleanup-error'].includes(mode))process.exit(7);if(['abort-error','escalation-error','denied-child-kill'].includes(mode)){process.on('SIGTERM',()=>{});if(mode==='denied-child-kill')setInterval(()=>{},1000);else setTimeout(()=>process.exit(7),2500)}else{spawn(process.execPath,[" + JSON.stringify(grandchild) + ",out+'.heartbeat'],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));if(mode==='early')setTimeout(()=>process.exit(0),250);else setInterval(()=>{},1000)}";
  await writeFile(fixture, fixtureSource); await chmod(fixture, 0o700);
  const sandbox = path.join(directory, 'never-executed-sandbox');
  await writeFile(sandbox, '#!/bin/sh\nexit 99\n'); await chmod(sandbox, 0o700);
  const wasm = path.join(directory, 'fixture.wasm'); await writeFile(wasm, Buffer.from([0,97,115,109]));
  const guard = path.join(directory, 'deny-network.mjs');
  await writeFile(guard, "import net from 'node:net';import tls from 'node:tls';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {writeFileSync} from 'node:fs';const deny=()=>{throw Error('NETWORK_FORBIDDEN')};globalThis.fetch=deny;net.Socket.prototype.connect=deny;tls.connect=deny;const out=process.argv.at(-1),mode=out.split('/').at(-1);if(mode==='timeout'){const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,ms===900000?500:ms,...args)}if(['cleanup-error','abort-error','escalation-error','denied-child-kill'].includes(mode)){const original=process.kill;process.kill=(pid,signal)=>{if(pid<0&&(['cleanup-error','denied-child-kill'].includes(mode)||mode==='abort-error'&&signal==='SIGTERM'||mode==='escalation-error'&&signal==='SIGKILL'))throw Object.assign(Error('SHOULD_NOT_LOG_SECRET'),{code:'EPERM',syscall:'kill'});return original(pid,signal)}}if(mode==='denied-child-kill'){const original=cp.spawn;cp.spawn=(...args)=>{const child=original(...args);child.kill=()=>{writeFileSync(out+'.direct-kill-attempt','denied');return false};return child};syncBuiltinESMExports()}");
  await appendFile(guard, "if(mode==='transient-eperm'){const original=process.kill;let denied=false,reads=0;process.kill=(pid,signal)=>{if(pid<0&&signal!==0){if(!denied&&signal==='SIGTERM'){denied=true;throw Object.assign(Error('hidden'),{code:'EPERM'})}throw Object.assign(Error('unexpected signal after EPERM'),{code:'EINVAL'})}if(pid<0&&reads++<2)throw Object.assign(Error('hidden'),{code:'EPERM'});return original(pid,signal)}}");
  await appendFile(guard, "if(mode==='unrelated-error'){const original=process.kill;process.kill=(pid,signal)=>{if(pid<0)throw Object.assign(Error('SHOULD_NOT_LOG_SECRET'),{code:'EIO'});return original(pid,signal)}}");
  for (const mode of ['SIGINT', 'SIGTERM', 'early', 'timeout', 'nonzero', 'rust-zero', 'rust-nonzero', ...(process.platform==='darwin'?['transient-eperm']:[]), 'cleanup-error', 'unrelated-error', 'abort-error', 'escalation-error', 'denied-child-kill', 'wrong-node']) {
    const output = path.join(directory, 'artifacts/local/runtime', mode);
    if (mode.startsWith('rust-')) await copyFile(rustFixture, fixture);
    else { await writeFile(fixture, fixtureSource); await chmod(fixture, 0o700); }
    if (mode==='wrong-node') await writeFile(path.join(directory, '.node-version'), '0.0.0\n');
    const child = spawn(process.execPath, ['--import', guard, wrapper, '--user-run', '--sandbox-bin', sandbox, '--wasm', wasm, '--output', output],
      { env:{ PATH:process.env.PATH, AGENTTRUST_SETUP_PRIVATE_KEY:'MUST_NOT_PROPAGATE', HOME:'/not-forwarded' }, stdio:['ignore','ignore','pipe'] });
    let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; });
    const exited = new Promise((resolve, reject) => { child.once('error',reject); child.once('close',(code,signal)=>resolve({code,signal})); });
    const processExited = new Promise((resolve) => { child.once('exit',(code,signal)=>resolve({code,signal})); });
    let deadline;
    try {
      if (mode!=='wrong-node') {
        const until = Date.now()+3000;
        while (true) { try { await readFile(output+(['nonzero','rust-zero','rust-nonzero','transient-eperm','cleanup-error','unrelated-error','abort-error','escalation-error','denied-child-kill'].includes(mode)?'.env':'.heartbeat')); break; } catch(error) { if(Date.now()>until)throw error; await wait(20); } }
        const env = JSON.parse(await readFile(output+'.env','utf8'));
        assert(!env.includes('AGENTTRUST_SETUP_PRIVATE_KEY') && !env.includes('HOME') && !env.includes('NODE_OPTIONS'));
      }
      if (mode==='SIGINT' || mode==='SIGTERM') { child.kill(mode); await wait(100); child.kill(mode); }
      if (['abort-error','escalation-error','denied-child-kill'].includes(mode)) child.kill('SIGINT');
      const result = await Promise.race([mode==='denied-child-kill'?processExited:exited,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('CLEANUP_TIMEOUT:'+mode)),5000);})]);
      assert.deepEqual(result,{code:mode==='SIGINT'?130:mode==='SIGTERM'?143:mode==='timeout'?124:['nonzero','rust-nonzero'].includes(mode)?7:['wrong-node','cleanup-error','unrelated-error','abort-error','escalation-error','denied-child-kill'].includes(mode)?1:0,signal:null},`${mode}: ${stderr}`);
      if (mode==='wrong-node') {
        assert.match(stderr, /PINNED_NODE_REQUIRED/);
        await assert.rejects(readFile(output+'.group'), {code:'ENOENT'});
      } else if (mode==='transient-eperm') {
        assert.match(stderr, /MIDNIGHT_OWNED_GROUP_OBSERVED_ABSENT_AFTER_EPERM/);
        assert(!stderr.includes('MIDNIGHT_LAUNCHER_ERROR') && !stderr.includes('CLEANUP_UNCONFIRMED'));
      } else if (['cleanup-error','unrelated-error','abort-error','escalation-error','denied-child-kill'].includes(mode)) {
        assert.match(stderr, mode==='unrelated-error'?/MIDNIGHT_LAUNCHER_ERROR: EIO/:/MIDNIGHT_LAUNCHER_ERROR: EPERM/);
        assert(!stderr.includes('OBSERVED_ABSENT_AFTER_EPERM'));
        assert.match(stderr, /MIDNIGHT_DESCENDANT_CLEANUP_UNCONFIRMED/);
        assert(!stderr.includes('SHOULD_NOT_LOG_SECRET'));
        await assert.rejects(readFile(output+'.heartbeat'), {code:'ENOENT'});
        if (mode==='denied-child-kill') {
          assert.equal(await readFile(output+'.direct-kill-attempt','utf8'), 'denied');
          const group=Number(await readFile(output+'.group','utf8'));
          assert.doesNotThrow(()=>process.kill(-group,0)); // The warning must not claim cleanup.
          // The test's unpatched parent reaps this deliberately unkillable stub in finally.
        }
      } else if (['nonzero','rust-zero','rust-nonzero'].includes(mode)) {
        assert.equal(stderr, '');
        await assert.rejects(readFile(output+'.heartbeat'), {code:'ENOENT'});
      } else {
        const stopped = await readFile(output+'.heartbeat','utf8'); await wait(120);
        assert.equal(await readFile(output+'.heartbeat','utf8'),stopped,'grandchild must stop before launcher returns');
      }
    } finally {
      clearTimeout(deadline); child.kill('SIGKILL');
      try { const group=Number(await readFile(output+'.group','utf8'));if(Number.isSafeInteger(group)&&group>0)process.kill(-group,'SIGKILL'); }
      catch(error) { if(!['ENOENT','ESRCH'].includes(error.code))throw error; }
      await exited;
    }
  }
  console.log(JSON.stringify({parser_and_environment:'passed',repeated_sigint:'passed',repeated_sigterm:'passed',
    early_exit_cleanup:'passed',wall_timeout_cleanup:'passed',nonzero_without_descendants:'passed',
    compiled_rust_exit:'passed',cleanup_error_releases_timer:'passed',sanitized_error:'passed',
    abort_error_cleanup:'passed',escalation_error_cleanup:'passed',
    denied_child_kill_reports_unconfirmed_and_exits:'passed',
    darwin_zombie_and_observed_disappearance:process.platform==='darwin'?'passed':'not_applicable',
    unrelated_error_stays_failure:'passed',
    node_pin_before_spawn:'passed',node_version:process.versions.node,actual_fixture_or_node_execution:false}));
} finally { await rm(directory,{recursive:true,force:true}); }
