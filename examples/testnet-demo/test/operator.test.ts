import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { launchOperatorChild, needsPrivateBundle, operatorArguments, operatorPlan } from "../src/operator.js";
const secrets = { keys: Object.fromEntries(["parent", "core", "owner", "issuer", "provider-a", "provider-b", "worker"].map((role) => [role, { private_key: `fixture-${role}-key` }])), invoices: { a: { seed_base64: "fixture-a-seed" }, b: { seed_base64: "fixture-b-seed" } } };
const source = { PATH: "/bin", HOME: "/wallet", NODE_OPTIONS: "--require=/bad", NODE_TLS_REJECT_UNAUTHORIZED: "0", DATABASE_URL: "db", AWS_SECRET_ACCESS_KEY: "aws", AGENTTRUST_SETUP_PRIVATE_KEY: "inherited-owner", AGENTTRUST_WORKER_PRIVATE_KEY: "inherited-worker", AGENTTRUST_INVOICE_SEED_BASE64: "inherited-seed", NEAR_AI_API_KEY: "fixture-model-key", NODE_EXTRA_CA_CERTS: "/explicit.crt" };
const setup = (step: string) => operatorArguments(["--user-run", "--directory", "/private/demo", "--setup", step, "--output", "artifacts/local/testnet/unit"]);
const worker = (step: string) => operatorArguments(["--user-run", "--directory", "/private/demo", "--worker", step, "--output", "artifacts/local/testnet/unit"]);
it.each([["deploy-core", "core"], ["owner-profile", "owner"], ["owner-worker-key", "owner"], ["issuer-issue-b", "issuer"], ["provider-a-register", "provider-a"], ["provider-b-rotate", "provider-b"]])("selects exactly one setup role for %s", (step, role) => {
  const plan = operatorPlan(setup(step!), "/repo", source, secrets);
  expect(plan.env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt", AGENTTRUST_SETUP_PRIVATE_KEY: `fixture-${role}-key` });
  expect(plan.entry).toBe("/repo/dist/examples/testnet-demo/src/prepare.js"); expect(plan.args.at(-1)).toBe(step);
});
it("passes only the restricted worker to a paid command", () => {
  expect(operatorPlan(worker("purchase"), "/repo", source, secrets).env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt", AGENTTRUST_WORKER_PRIVATE_KEY: "fixture-worker-key" });
});
it.each([setup("validate-b"), setup("observe-owner-deposit"), worker("resume"), worker("observe-retry"), operatorArguments(["--directory", "/private/demo", "--replay-buyer", "near-ai"]), operatorArguments(["--directory", "/private/demo", "--replay-buyer", "local-model"])])("keeps observations and saved buyer replay keyless", (args) => {
  expect(needsPrivateBundle(args)).toBe(false);
  expect(operatorPlan(args, "/repo", source).env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt" });
});
it("keeps model and provider credentials in their respective child", () => {
  const buyer = operatorPlan(operatorArguments(["--user-run", "--directory", "/private/demo", "--buyer", "near-ai"]), "/repo", source, secrets);
  expect(buyer.env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt", AGENTTRUST_WORKER_PRIVATE_KEY: "fixture-worker-key", NEAR_AI_API_KEY: "fixture-model-key" });
  const localBuyer = operatorPlan(operatorArguments(["--user-run", "--directory", "/private/demo", "--buyer", "local-model"]), "/repo", source, secrets);
  expect(localBuyer.env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt", AGENTTRUST_WORKER_PRIVATE_KEY: "fixture-worker-key" });
  expect(localBuyer.args).toEqual(["--config", "/private/demo/buyer-local-model.json", "--execute"]);
  const local = operatorPlan(operatorArguments(["--directory", "/private/demo", "--local", "start"]), "/repo", source, secrets);
  expect(local.env).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.crt", AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64: "fixture-a-seed", AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64: "fixture-b-seed" });
});
it("rejects arbitrary commands, escaping output paths and missing explicit execution before secret loading", () => {
  for (const args of [["--directory", "/private/demo", "--buyer", "near-ai"], ["--directory", "/private/demo", "--exec", "sh"], ["--user-run", "--directory", "/private/demo", "--setup", "shell", "--output", "artifacts/local/testnet/x"], ["--user-run", "--directory", "/private/demo", "--worker", "purchase", "--output", "../outside"], ["--directory", "relative", "--local", "start"]]) expect(() => operatorArguments(args)).toThrow("OPERATOR_ARGUMENTS_REQUIRED");
});
it.skipIf(process.platform === "win32")("interrupts the entire child tree, including a grandchild that ignores SIGTERM", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "agenttrust-operator-tree-"));
  const heartbeat = path.join(directory, "heartbeat"), entry = path.join(directory, "child.mjs"), grandchild = path.join(directory, "grandchild.mjs");
  await writeFile(grandchild, "import fs from 'node:fs';process.on('SIGTERM',()=>{});let i=0;setInterval(()=>fs.writeFileSync(process.argv[2],String(++i)),20);");
  await writeFile(entry, "import{spawn}from'node:child_process';spawn(process.execPath,[process.argv[2],process.argv[3]],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);");
  const controller = new AbortController();
  const running = launchOperatorChild({ entry, args: [grandchild, heartbeat], cwd: directory, env: {} }, controller.signal);
  try {
    const until = Date.now() + 2000;
    while (true) { try { await readFile(heartbeat); break; } catch (error) { if (Date.now() >= until) throw error; await new Promise((resolve) => setTimeout(resolve, 20)); } }
    controller.abort(); expect(await running).toBe(130);
    const stopped = await readFile(heartbeat, "utf8"); await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await readFile(heartbeat, "utf8")).toBe(stopped);
  } finally { controller.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});
