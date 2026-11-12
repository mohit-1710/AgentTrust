/** Actual compiled CLI: offline preparation and pure faucet doubles; all outbound network is denied. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
const root = process.cwd(), directory = await mkdtemp(path.join(await realpath(tmpdir()), "agenttrust-bootstrap-smoke-"));
try {
  const guard = path.join(directory, "deny-network.mjs");
  await writeFile(guard, `import net from "node:net"; import tls from "node:tls"; import http from "node:http"; import https from "node:https"; import {syncBuiltinESMExports} from "node:module"; const deny=()=>{throw new Error("NETWORK_FORBIDDEN_IN_OFFLINE_SMOKE")}; globalThis.fetch=deny; net.Socket.prototype.connect=deny; net.connect=deny; net.createConnection=deny; tls.connect=deny; http.request=deny; http.get=deny; https.request=deny; https.get=deny; syncBuiltinESMExports();`, { mode: 0o600 });
  const run = (args, extraImports = []) => execFileSync(process.execPath, ["--import", guard, ...extraImports.flatMap((file) => ["--import", file]), path.join(root, "dist/examples/testnet-demo/src/bootstrap.js"), ...args], { cwd: root, encoding: "utf8", timeout: 30_000, env: { PATH: process.env.PATH, AGENTTRUST_SETUP_PRIVATE_KEY: "DO_NOT_READ_SHELL_KEY", NEAR_AI_API_KEY: "DO_NOT_READ_MODEL_KEY" }, stdio: ["ignore", "pipe", "pipe"] });
  assert.match(run(["--help"]), /USER-RUN/);
  const bundle = path.join(directory, "demo"), output = run(["--prepare", "--directory", bundle]);
  const result = JSON.parse(output); assert.equal(result.status, "prepared"); assert.equal(result.accounts_created, false);
  for (const name of await readdir(path.join(bundle, "secrets"))) {
    const value = JSON.parse(await readFile(path.join(bundle, "secrets", name), "utf8"));
    assert(!output.includes(value.private_key ?? value.seed_base64));
  }
  assert(!output.includes("DO_NOT_READ"));
  // Convert this newly generated temporary fixture into the exact legacy public forms.
  const rpcFiles = ["demo.json", "provider-a.json", "provider-b.json", "mcp.json"];
  for (const name of rpcFiles) { const file = path.join(bundle,name), value=JSON.parse(await readFile(file,"utf8")); assert.equal(value.rpc_url,"https://test.rpc.fastnear.com"); value.rpc_url="https://rpc.testnet.near.org"; await writeFile(file,JSON.stringify(value)+"\n"); }
  const manifestFile=path.join(bundle,"bootstrap.json"), manifest=JSON.parse(await readFile(manifestFile,"utf8"));
  manifest.rpc_url="https://rpc.testnet.near.org"; manifest.demo_sha256=createHash("sha256").update(JSON.stringify(JSON.parse(await readFile(path.join(bundle,"demo.json"),"utf8")))).digest("hex");
  await writeFile(manifestFile,JSON.stringify(manifest)+"\n");
  const originalManifest=await readFile(manifestFile,"utf8");
  const original = await readFile(path.join(bundle, "demo.json"), "utf8");
  assert.throws(() => run(["--prepare", "--directory", bundle]), (error) => error.status === 1 && error.stderr.includes("BOOTSTRAP_REFUSED_OR_FAILED") && !error.stderr.includes("ed25519:"));
  assert.equal(await readFile(path.join(bundle, "demo.json"), "utf8"), original);
  assert.deepEqual(await readdir(path.join(bundle, "operations")), []);
  const mock = path.join(directory, "mock-faucet.mjs"), trace = path.join(directory, "mock-dispatch.json");
  await writeFile(mock, `import {JsonRpcProvider} from ${JSON.stringify(pathToFileURL(path.join(root, "node_modules/near-api-js/lib/index.js")).href)}; import {AccountDoesNotExistError} from ${JSON.stringify(pathToFileURL(path.join(root, "node_modules/near-api-js/lib/rpc-errors/index.js")).href)}; import {writeFileSync} from "node:fs"; JsonRpcProvider.prototype.sendJsonRpc=async(method)=>{if(method!=="status")throw new Error("UNEXPECTED_RPC");return{chain_id:"testnet"}}; JsonRpcProvider.prototype.viewAccount=async({accountId})=>{throw new AccountDoesNotExistError(accountId,"11111111111111111111111111111111",1)}; globalThis.fetch=async(url,init)=>{if(url!=="https://helper.nearprotocol.com/account"||init.method!=="POST")throw new Error("UNEXPECTED_FETCH");writeFileSync(${JSON.stringify(trace)},init.body,{flag:"wx",mode:0o600});throw new Error("SIMULATED_AMBIGUOUS_RESPONSE")};`, {mode:0o600});
  const operational = ["--user-run", "--directory", bundle, "--step", "faucet"];
  assert.throws(() => run(operational, [mock]), (error) => error.status === 2 && JSON.parse(error.stdout).status === "uncertain");
  const claim = await readFile(path.join(bundle, "operations/faucet.json"), "utf8"), dispatched = await readFile(trace, "utf8");
  assert.deepEqual(JSON.parse(claim).request, JSON.parse(dispatched));
  // A new process cannot repeat the mocked POST or replace the immutable claim.
  assert.throws(() => run(operational, [mock]), (error) => error.status === 1 && error.stderr.includes("BOOTSTRAP_REFUSED_OR_FAILED"));
  assert.equal(await readFile(path.join(bundle, "operations/faucet.json"), "utf8"), claim);
  assert.equal(await readFile(trace, "utf8"), dispatched);
  assert.throws(() => run(["--user-run", "--directory", bundle, "--step", "observe-faucet"], [mock]), (error) => error.status === 2 && JSON.parse(error.stdout).status === "uncertain");
  const interrupt=path.join(directory,"interrupt-rename.mjs");
  await writeFile(interrupt,`import fs from "node:fs/promises"; import {syncBuiltinESMExports} from "node:module"; const original=fs.rename;let count=0;fs.rename=async(...args)=>{if(count++===1)throw new Error("MOCK_INTERRUPTED_MIGRATION");return original(...args)};syncBuiltinESMExports();`,{mode:0o600});
  assert.throws(()=>run(["--migrate-rpc-fastnear","--directory",bundle],[interrupt]),error=>error.status===1);
  assert.equal(JSON.parse(await readFile(path.join(bundle,"demo.json"),"utf8")).rpc_url,"https://test.rpc.fastnear.com");
  assert.equal(JSON.parse(await readFile(path.join(bundle,"provider-a.json"),"utf8")).rpc_url,"https://rpc.testnet.near.org");
  assert.throws(()=>run(["--user-run","--directory",bundle,"--step","observe-faucet"]),error=>error.status===1);
  const migration=JSON.parse(run(["--resume-rpc-fastnear","--directory",bundle]));
  assert.equal(migration.status,"rpc_migrated");assert.equal(migration.network_contacted,false);
  for(const name of rpcFiles)assert.equal(JSON.parse(await readFile(path.join(bundle,name),"utf8")).rpc_url,"https://test.rpc.fastnear.com");
  assert.equal(await readFile(manifestFile,"utf8"),originalManifest);
  assert.equal(await readFile(path.join(bundle,"operations/faucet.json"),"utf8"),claim);
  assert.deepEqual(JSON.parse(run(["--resume-rpc-fastnear","--directory",bundle])),migration);
  assert.throws(()=>run(operational),error=>error.status===1);
  console.log(JSON.stringify({ compiled_help: "passed", compiled_offline_prepare: "passed", outbound_network: "denied", overwrite_refusal: "passed", mocked_faucet_restart_no_resend: "passed", compiled_offline_migration_resume: "passed", actual_chain_or_faucet_execution: false }));
} finally { await rm(directory, { recursive: true, force: true }); }
