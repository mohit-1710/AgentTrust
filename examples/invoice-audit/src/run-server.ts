import { createPrivateKey, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import { createAuditHttpServer, createAuditHttpsServer, type ServiceOffer } from "./server.js";
import { readProviderTls } from "./tls.js";

interface ServerFile {
  schema_version: 1; network: "near:testnet"; core_account: string; rpc_url: string;
  offer: ServiceOffer; retained_offers?: ServiceOffer[]; port: number;
  tls?: { cert_file: string; key_file: string };
}
const usage = "Usage: pnpm start:invoice-audit --config /absolute/provider.json\nSet AGENTTRUST_INVOICE_SEED_BASE64 to a dedicated 32-byte invoice signing seed. The listener binds 127.0.0.1. Optional tls:{cert_file,key_file} serves the matching localhost HTTPS origin; otherwise use your HTTPS reverse proxy.";
export async function runServer(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.log(usage); return; }
  if (argv.length !== 2 || argv[0] !== "--config" || !argv[1]?.startsWith("/")) throw new Error(usage);
  const text = await readFile(argv[1], "utf8");
  if (Buffer.byteLength(text) > 32 * 1024) throw new Error("CONFIG_TOO_LARGE");
  const config = JSON.parse(text) as ServerFile;
  if (config.schema_version !== 1 || config.network !== "near:testnet" || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error("INVALID_SERVER_CONFIG");
  const seed = process.env.AGENTTRUST_INVOICE_SEED_BASE64;
  if (typeof seed !== "string" || Buffer.from(seed, "base64").length !== 32 || Buffer.from(seed, "base64").toString("base64") !== seed) throw new Error("INVALID_INVOICE_SIGNING_SEED");
  const secret = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed, "base64")]), format: "der", type: "pkcs8" });
  const reader = new AgentTrustClient({ network: config.network, coreAccount: config.core_account, rpcUrl: config.rpc_url });
  const serverConfig = { network: config.network, core_account: config.core_account, offer: config.offer, ...(config.retained_offers ? { retainedOffers: config.retained_offers } : {}), sign: (bytes: Uint8Array) => sign(null, bytes, secret).toString("base64"), reader };
  const server = config.tls === undefined ? createAuditHttpServer(serverConfig)
    : createAuditHttpsServer(serverConfig, await readProviderTls(config.tls, config.offer.origin, config.port));
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(config.port, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  console.log(`Invoice audit ${config.tls ? "HTTPS" : "HTTP"} listener ready on 127.0.0.1:${config.port}; no chain transaction was sent.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServer(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : "SERVER_START_FAILED"); process.exitCode = 1; });
}
