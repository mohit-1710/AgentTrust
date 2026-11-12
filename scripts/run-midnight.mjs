// USER-RUN ONLY. Owns the fixed fixture and its Sandbox as one POSIX process group.
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const usage = 'USER-RUN ONLY: node scripts/run-midnight.mjs --user-run --sandbox-bin /absolute/pinned/near-sandbox --wasm /absolute/production.wasm --output /absolute/repository/artifacts/local/runtime/NEW-directory\nBuild agenttrust-midnight first. Creates one local Sandbox; no remote keys, deployment or automatic retry.';
export function parseArguments(args) {
  if (args.length !== 7 || args[0] !== '--user-run') throw Error('EXPLICIT_USER_RUN_ARGUMENTS_REQUIRED');
  const values = new Map();
  for (let i = 1; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    if (!['--sandbox-bin', '--wasm', '--output'].includes(name) || !path.isAbsolute(value ?? '') || values.has(name)) throw Error('INVALID_MIDNIGHT_ARGUMENTS');
    values.set(name, value);
  }
  return values;
}
export function fixtureEnvironment(environment, sandbox, command) {
  const env = { NEAR_SANDBOX_BIN_PATH: sandbox, AGENTTRUST_RUNTIME_COMMAND: command };
  for (const name of ['PATH', 'TMPDIR']) if (environment[name]) env[name] = environment[name];
  return env;
}
// Read-only observation of a known owned process group. EPERM is unresolved;
// only ESRCH proves disappearance, including after a zombie has been reaped.
export async function observeGroupDisappearance(pid, deadline) {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw Error('OWNED_GROUP_PID_REQUIRED');
  for (;;) {
    try { process.kill(-pid, 0); }
    catch (error) {
      if (error.code === 'ESRCH') return true;
      if (error.code !== 'EPERM') throw error;
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, deadline - Date.now())));
  }
}
export async function runMidnight(args) {
  if (process.platform === 'win32') throw Error('POSIX_REQUIRED');
  const values = parseArguments(args);
  const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
  const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
  if (process.versions.node !== expectedNode) throw Error(`PINNED_NODE_REQUIRED: expected ${expectedNode}; source scripts/env.sh before running.`);
  const fixture = path.join(root, 'tests/runtime/target/debug/agenttrust-midnight');
  const sandbox = await realpath(values.get('--sandbox-bin'));
  const wasm = await realpath(values.get('--wasm'));
  for (const file of [fixture, sandbox, wasm]) if (!(await lstat(file)).isFile()) throw Error('REGULAR_INPUT_FILE_REQUIRED');
  await access(fixture, constants.X_OK); await access(sandbox, constants.X_OK);
  const bytes = await readFile(wasm);
  if (!bytes.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109])) || bytes.includes(Buffer.from('RUNTIME_TEST_CALLBACK_FAILURE')) || bytes.includes(Buffer.from('AGENTTRUST_RUNTIME_HELPER_ONLY'))) throw Error('PRODUCTION_WASM_REQUIRED');
  const output = path.resolve(values.get('--output'));
  if (!output.startsWith(path.join(root, 'artifacts/local/runtime') + path.sep)) throw Error('IGNORED_RUNTIME_OUTPUT_REQUIRED');
  for (let dir = path.dirname(output); dir !== root; dir = path.dirname(dir)) {
    try { if ((await lstat(dir)).isSymbolicLink()) throw Error('SYMLINK_OUTPUT_PARENT'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try { await lstat(output); throw Error('OUTPUT_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(output), { recursive: true });
  const controller = new AbortController();
  let interruptedCode = null;
  const interrupt = () => { interruptedCode ??= 130; controller.abort(); };
  const terminate = () => { interruptedCode ??= 143; controller.abort(); };
  // Persistent listeners cover repeated signals through group cleanup.
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  let child, deadline = 0, escalation, cleanupFailure, rejectCleanup, epermObservationDeadline, recoverableEpermOnly = true;
  const cleanupFailed = new Promise((_, reject) => { rejectCleanup = reject; });
  const recordCleanupFailure = (error) => {
    cleanupFailure ??= error;
    recoverableEpermOnly &&= process.platform === 'darwin' && error.code === 'EPERM'
      && child?.pid && (child.exitCode !== null || child.signalCode !== null);
    if (recoverableEpermOnly) epermObservationDeadline ??= Date.now() + 2000;
  };
  const group = (signal) => {
    if (!child?.pid) return false;
    try { process.kill(-child.pid, signal); return true; }
    catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  const stop = () => {
    if (deadline) return;
    deadline = Date.now() + 2000;
    let needsEscalation = true;
    try { needsEscalation = group('SIGTERM'); }
    catch (error) { recordCleanupFailure(error); }
    if (needsEscalation) escalation = setTimeout(() => {
      try { group('SIGKILL'); }
      catch (error) {
        recordCleanupFailure(error);
        rejectCleanup(cleanupFailure); // Reject through the awaited path, not the timer callback.
      }
    }, 2000);
  };
  const timeout = setTimeout(() => { interruptedCode ??= 124; controller.abort(); }, 900_000);
  try {
    const command = 'node scripts/run-midnight.mjs ' + args.map((arg) => JSON.stringify(arg)).join(' ');
    child = spawn(fixture, ['--user-run', '--wasm', wasm, '--out', output], {
      cwd: root, env: fixtureEnvironment(process.env, sandbox, command), stdio: 'inherit', detached: true,
    });
    controller.signal.addEventListener('abort', stop, { once: true });
    if (controller.signal.aborted) stop();
    const exited = new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', (code) => resolve(code ?? 1));
    });
    const code = await Promise.race([exited, cleanupFailed]);
    return interruptedCode ?? code;
  } finally {
    controller.signal.removeEventListener('abort', stop);
    try {
      try {
        stop(); // Early fixture exit must not leave its node alive.
        if (!cleanupFailure) {
          while (group(0) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
          if (group(0)) group('SIGKILL');
        }
      } catch (error) { recordCleanupFailure(error); }
      if (cleanupFailure) {
        if (escalation) clearTimeout(escalation);
        if (recoverableEpermOnly) {
          // Darwin can report EPERM for a zombie-only group. Do not assume that
          // cause or send further signals: wait only for observed disappearance.
          try {
            if (await observeGroupDisappearance(child.pid, epermObservationDeadline)) {
              cleanupFailure = undefined;
              console.error('MIDNIGHT_OWNED_GROUP_OBSERVED_ABSENT_AFTER_EPERM');
            }
          } catch (error) { recordCleanupFailure(error); }
        } else {
          try { group('SIGKILL'); } catch (error) { recordCleanupFailure(error); }
        }
      }
    } finally {
      // A failed group probe/signal must not strand the launcher on its wall timer.
      clearTimeout(timeout); if (escalation) clearTimeout(escalation);
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
    }
    if (cleanupFailure) {
      // Group failure leaves descendant status unknown. Try only our direct
      // child as a fallback, then release its handle so reporting cannot hang.
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGKILL'); } catch { /* Report the original group error. */ }
        child.unref();
      }
      const failure = Object.assign(Error('GROUP_CLEANUP_FAILED'), {
        code: cleanupFailure.code, descendantCleanupUnconfirmed: true,
      });
      throw failure;
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(usage);
  else runMidnight(args).then((code) => { process.exitCode = code; }).catch((error) => {
    if (error.message?.startsWith('PINNED_NODE_REQUIRED:')) console.error(error.message);
    const code = typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(error.code) ? error.code : 'UNKNOWN';
    const name = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError'].includes(error.name) ? error.name : 'UnknownError';
    console.error(`MIDNIGHT_LAUNCHER_ERROR: ${code}${code === 'UNKNOWN' ? ` (${name})` : ''}`);
    if (error.descendantCleanupUnconfirmed) console.error('MIDNIGHT_DESCENDANT_CLEANUP_UNCONFIRMED: inspect the owned process group; cleanup did not prove it stopped.');
    console.error('MIDNIGHT_FIXTURE_REFUSED_OR_FAILED: retain any original capture; no automatic retry.');
    process.exitCode = 1;
  });
}
