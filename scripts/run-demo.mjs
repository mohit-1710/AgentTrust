// No network, key installation or account creation in this launcher. It starts only explicit user-run CLI paths.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function isolatedEnvironment(mode, source) {
  if (!['prepare', 'run'].includes(mode)) throw new Error('INVALID_DEMO_MODE');
  const env = {};
  for (const name of ['PATH', 'TMPDIR', 'SYSTEMROOT', 'NODE_EXTRA_CA_CERTS']) if (source[name]) env[name] = source[name];
  const key = mode === 'prepare' ? 'AGENTTRUST_SETUP_PRIVATE_KEY' : 'AGENTTRUST_WORKER_PRIVATE_KEY';
  if (source[key]) env[key] = source[key];
  // In particular, no HOME wallet discovery, NODE_OPTIONS, TLS bypass, AWS/database keys,
  // owner/deploy/issuer keys or invoice seed are inherited by the worker child.
  return env;
}
export function launchArguments(argv) {
  const [mode, ...rest] = argv;
  if (!['prepare', 'run'].includes(mode)) throw new Error('INVALID_DEMO_MODE');
  const args = rest[0] === '--' ? rest.slice(1) : rest;
  const localOnly = args.length === 1 && args[0] === '--help' || mode === 'prepare' && (args.length === 1 && args[0] === '--template' || args.length === 2 && args[0] === '--render-config');
  if (!localOnly && args[0] !== '--user-run') throw new Error('EXPLICIT_USER_RUN_REQUIRED');
  return { mode, args, entry: `dist/examples/testnet-demo/src/${mode === 'prepare' ? 'prepare' : 'run'}.js` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { mode, args, entry } = launchArguments(process.argv.slice(2));
    const child = spawnSync(process.execPath, [entry, ...args], { env: isolatedEnvironment(mode, process.env), stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  } catch { console.error('DEMO_LAUNCH_REFUSED: build:services first; use --help, or the explicit --user-run command from docs/testnet-demo-runbook.md.'); process.exitCode = 1; }
}
