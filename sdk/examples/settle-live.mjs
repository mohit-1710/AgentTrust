// Live end-to-end x402 settlement against the deployed AgentTrust server.
// Runs the real verify -> gate -> settle path on Monad testnet:
//   - payee 1764 (scammer): gate DENY -> server 403, no USDC moves
//   - payee 1763 (trusted): gate ALLOW -> facilitator settles -> real USDC tx
// PRIVATE_KEY is read from the environment (never hard-coded / printed).
import { payThroughGate } from "../dist/index.js";

const SERVER = "https://monad-agenttrust-server.fly.dev/protected/report";
const raw = process.env.PRIVATE_KEY;
if (!raw) { console.error("PRIVATE_KEY missing"); process.exit(1); }
const privateKey = raw.startsWith("0x") ? raw : `0x${raw}`;

function decodeSettle(h) {
  try { return JSON.parse(Buffer.from(h, "base64").toString("utf8")); }
  catch { return null; }
}

async function run(agentId, label) {
  console.log(`\n=== ${label}: pay payee agent ${agentId} ===`);
  try {
    const res = await payThroughGate({ url: SERVER, privateKey, payeeAgentId: agentId });
    console.log(`HTTP ${res.status} ${res.statusText}`);
    const xpr = res.headers.get("x-payment-response");
    if (xpr) {
      const s = decodeSettle(xpr) ?? {};
      const tx = s.transaction || s.txHash || s.payload?.transaction;
      console.log(`SETTLED on-chain -> tx: ${tx}`);
      if (tx) console.log(`explorer: https://testnet.monadexplorer.com/tx/${tx}`);
    }
    const body = await res.text();
    console.log(`body: ${body.slice(0, 220)}`);
  } catch (e) {
    console.log(`blocked / error: ${e.message}`);
    if (e.cause) console.log(`cause:`, e.cause);
    console.log(`stack:`, e.stack?.split("\n").slice(0, 6).join("\n"));
  }
}

await run("1764", "DENY expected (scammer)");
await run("1763", "ALLOW expected (trusted) -> real settlement");
