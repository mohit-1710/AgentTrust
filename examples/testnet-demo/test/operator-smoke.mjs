/** Compiled operator signal bridge; stub children, ordinary files, no network or credentials. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform === "win32") throw new Error("POSIX_OPERATOR_REQUIRED");
const directory = await mkdtemp(path.join(tmpdir(), "agenttrust-operator-smoke-"));
const operator = pathToFileURL(path.resolve("dist/examples/testnet-demo/src/operator.js")).href;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const grandchild = path.join(directory, "grandchild.mjs"), child = path.join(directory, "child.mjs"), wrapper = path.join(directory, "wrapper.mjs");
  await writeFile(grandchild, "import fs from 'node:fs';process.on('SIGTERM',()=>{});let i=0;setInterval(()=>fs.writeFileSync(process.argv[2],String(++i)),20);");
  await writeFile(child, "import fs from 'node:fs';import{spawn}from'node:child_process';fs.writeFileSync(process.argv[4],String(process.pid));spawn(process.execPath,[process.argv[2],process.argv[3]],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));if(process.argv[5]==='early')setTimeout(()=>process.exit(0),250);else setInterval(()=>{},1000);");
  await writeFile(wrapper, `import net from 'node:net';import tls from 'node:tls';import http from 'node:http';import https from 'node:https';const deny=()=>{throw new Error('NETWORK_FORBIDDEN')};globalThis.fetch=deny;net.Socket.prototype.connect=deny;net.connect=deny;tls.connect=deny;http.request=deny;https.request=deny;const{runWithOperatorSignals}=await import(${JSON.stringify(operator)});process.exitCode=await runWithOperatorSignals(JSON.parse(process.argv[2]));`);
  for (const mode of ["SIGINT", "SIGTERM", "early"]) {
    const heartbeat = path.join(directory, `${mode}-heartbeat`), groupFile = path.join(directory, `${mode}-group`);
    const plan = { entry: child, args: [grandchild, heartbeat, groupFile, mode], cwd: directory, env: {} };
    const processUnderTest = spawn(process.execPath, [wrapper, JSON.stringify(plan)], { env: {}, stdio: "ignore" });
    const exited = new Promise((resolve, reject) => { processUnderTest.once("error", reject); processUnderTest.once("close", (code, signal) => resolve({ code, signal })); });
    let timeout;
    try {
      const until = Date.now() + 3000;
      while (true) { try { await readFile(heartbeat); break; } catch (error) { if (Date.now() >= until) throw error; await delay(20); } }
      if (mode !== "early") { processUnderTest.kill(mode); await delay(100); processUnderTest.kill(mode); }
      const result = await Promise.race([exited, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("OPERATOR_CLEANUP_TIMEOUT")), 5000); })]);
      assert.deepEqual(result, { code: mode === "early" ? 0 : 130, signal: null });
      const stopped = await readFile(heartbeat, "utf8"); await delay(120);
      assert.equal(await readFile(heartbeat, "utf8"), stopped, "grandchild must stop before operator returns");
    } finally {
      clearTimeout(timeout); processUnderTest.kill("SIGKILL");
      try { const group = Number(await readFile(groupFile, "utf8")); if (Number.isSafeInteger(group) && group > 0) process.kill(-group, "SIGKILL"); } catch (error) { if (!["ENOENT", "ESRCH"].includes(error.code)) throw error; }
      await exited;
    }
  }
  console.log(JSON.stringify({ compiled_repeated_sigint: "passed", compiled_repeated_sigterm: "passed", early_exit_tree_cleanup: "passed", credentials_or_network_used: false }));
} finally { await rm(directory, { recursive: true, force: true }); }
