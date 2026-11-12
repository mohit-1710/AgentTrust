/** Fixed local/demo entrypoints only; never a generic credential-bearing command runner. */
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadBootstrapBundle } from "./bootstrap.js";
import { readConfig } from "./config.js";
import { setupSteps } from "./prepare.js";
import { runSteps } from "./run.js";

export type OperatorArgs = { directory: string } & (
  { kind: "local"; mode: "check" | "start" } |
  { kind: "buyer"; mode: "scripted" | "near-ai" } | { kind: "replay"; mode: "scripted" | "near-ai" } |
  { kind: "setup"; step: string; output: string } | { kind: "worker"; step: string; output: string }
);
type Secrets = { keys: Record<string, { private_key: string }>; invoices: { a: { seed_base64: string }; b: { seed_base64: string } } };
export function operatorArguments(input: readonly string[]): OperatorArgs {
  const userRun = input[0] === "--user-run", argv = userRun ? input.slice(1) : input;
  const directory = argv[1], choice = argv[3];
  if (argv[0] !== "--directory" || !directory || !path.isAbsolute(directory)) throw new Error("OPERATOR_ARGUMENTS_REQUIRED");
  if (!userRun && argv.length === 4 && argv[2] === "--local" && (choice === "check" || choice === "start")) return { directory, kind: "local", mode: choice };
  if (argv.length === 4 && (choice === "scripted" || choice === "near-ai") && (userRun && argv[2] === "--buyer" || !userRun && argv[2] === "--replay-buyer")) return { directory, kind: userRun ? "buyer" : "replay", mode: choice };
  if (userRun && argv.length === 6 && (argv[2] === "--setup" || argv[2] === "--worker") && choice && argv[4] === "--output" && /^artifacts\/local\/testnet\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(argv[5]!)) {
    const known = argv[2] === "--setup" ? [...setupSteps, ...setupSteps.filter((s) => s !== "validate-b").map((s) => `observe-${s}`)] : [...runSteps];
    if (known.includes(choice)) return { directory, kind: argv[2] === "--setup" ? "setup" : "worker", step: choice, output: argv[5]! };
  }
  throw new Error("OPERATOR_ARGUMENTS_REQUIRED");
}
export function needsPrivateBundle(args: OperatorArgs): boolean {
  if (args.kind === "replay") return false;
  if (args.kind === "setup") return args.step !== "validate-b" && !args.step.startsWith("observe-");
  if (args.kind === "worker") return args.step !== "resume" && !args.step.startsWith("observe-");
  return true;
}
export function operatorPlan(args: OperatorArgs, root: string, source: NodeJS.ProcessEnv, secrets?: Secrets) {
  const env: Record<string, string> = {};
  for (const key of ["PATH", "TMPDIR", "SYSTEMROOT", "NODE_EXTRA_CA_CERTS"]) if (source[key]) env[key] = source[key]!;
  const keyFor = (role: string) => { const key = secrets?.keys[role]?.private_key; if (!key) throw new Error("PRIVATE_BUNDLE_REQUIRED"); return key; };
  let entry: string, childArgs: string[];
  if (args.kind === "local") {
    if (!secrets?.invoices.a.seed_base64 || !secrets.invoices.b.seed_base64) throw new Error("PRIVATE_BUNDLE_REQUIRED");
    env.AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64 = secrets.invoices.a.seed_base64;
    env.AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64 = secrets.invoices.b.seed_base64;
    if (source.AGENTTRUST_NEAR_DECISION_REFS) env.AGENTTRUST_NEAR_DECISION_REFS = source.AGENTTRUST_NEAR_DECISION_REFS;
    entry = "examples/testnet-demo/src/local.js"; childArgs = [`--${args.mode}`, "--directory", args.directory];
  } else if (args.kind === "buyer" || args.kind === "replay") {
    if (args.kind === "buyer") {
      env.AGENTTRUST_WORKER_PRIVATE_KEY = keyFor("worker");
      if (args.mode === "near-ai" && source.NEAR_AI_API_KEY) env.NEAR_AI_API_KEY = source.NEAR_AI_API_KEY;
    }
    entry = "examples/buyer-agent/src/run.js"; childArgs = ["--config", path.join(args.directory, `buyer-${args.mode}.json`), "--execute"];
  } else {
    if (needsPrivateBundle(args)) {
      if (args.kind === "worker") env.AGENTTRUST_WORKER_PRIVATE_KEY = keyFor("worker");
      else {
        const role = args.step === "deploy-core" ? "core" : args.step.startsWith("owner-") ? "owner" : args.step.startsWith("issuer-") ? "issuer" : args.step.startsWith("provider-a-") ? "provider-a" : "provider-b";
        env.AGENTTRUST_SETUP_PRIVATE_KEY = keyFor(role);
      }
    }
    entry = `examples/testnet-demo/src/${args.kind === "setup" ? "prepare" : "run"}.js`;
    childArgs = ["--user-run", "--config", path.join(args.directory, "demo.json"), "--output", args.output, "--step", args.step];
  }
  return { entry: path.join(root, "dist", entry), args: childArgs, cwd: root, env };
}

/** Own process group includes the buyer's MCP child and the local stack's listeners. */
export async function launchOperatorChild(plan: ReturnType<typeof operatorPlan>, signal?: AbortSignal): Promise<number> {
  if (process.platform === "win32") throw new Error("POSIX_OPERATOR_REQUIRED");
  if (signal?.aborted) return 130;
  const child = spawn(process.execPath, [plan.entry, ...plan.args], { cwd: plan.cwd, env: plan.env, stdio: "inherit", detached: true });
  let deadline = 0, escalation: ReturnType<typeof setTimeout> | undefined;
  const group = (action: NodeJS.Signals | 0): boolean => {
    if (!child.pid) return false;
    try { process.kill(-child.pid, action); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
  };
  const stop = () => {
    if (deadline) return;
    deadline = Date.now() + 2000;
    if (group("SIGTERM")) escalation = setTimeout(() => { group("SIGKILL"); }, 2000);
  };
  signal?.addEventListener("abort", stop, { once: true });
  try {
    const code = await new Promise<number>((resolve, reject) => { child.once("error", reject); child.once("close", (code) => resolve(code ?? 1)); });
    return signal?.aborted ? 130 : code;
  } finally {
    signal?.removeEventListener("abort", stop);
    stop(); // A child that exits early must not leave a payment-capable grandchild.
    while (group(0) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    if (group(0)) group("SIGKILL");
    if (escalation) clearTimeout(escalation);
  }
}
export async function runWithOperatorSignals(plan: ReturnType<typeof operatorPlan>): Promise<number> {
  const controller = new AbortController(), stop = () => controller.abort();
  // Keep handling repeated interrupts until the group's escalation has finished.
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    return await launchOperatorChild(plan, controller.signal);
  } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
export async function runOperator(argv: readonly string[]): Promise<void> {
  const args = operatorArguments(argv), root = fileURLToPath(new URL("../../../../", import.meta.url));
  // Observations/replay deliberately work without the private bundle or any key.
  const bundle = needsPrivateBundle(args) ? await loadBootstrapBundle(args.directory, root) : undefined;
  if (!bundle) await readConfig(path.join(args.directory, "demo.json"));
  process.exitCode = await runWithOperatorSignals(operatorPlan(args, root, process.env, bundle));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") console.log("operator.js --directory /absolute/demo --local check|start\noperator.js --directory /absolute/demo --replay-buyer scripted|near-ai\noperator.js --user-run --directory /absolute/demo --setup STEP --output artifacts/local/testnet/NEW_NAME\noperator.js --user-run --directory /absolute/demo --worker STEP --output artifacts/local/testnet/NEW_NAME\noperator.js --user-run --directory /absolute/demo --buyer scripted|near-ai\nPOSIX operator (macOS/Linux). Loads only the required role into a fixed child process group and stops that group on interruption. Observations and saved buyer replay need no private bundle. Setup/worker/buyer execution can deploy, change state or spend testnet/model funds; no automatic next step or retry. No browser is launched.");
  else runOperator(argv).catch(() => { console.error("OPERATOR_REFUSED_OR_FAILED: inspect configuration and original operation records; no secret or raw error is logged."); process.exitCode = 1; });
}
