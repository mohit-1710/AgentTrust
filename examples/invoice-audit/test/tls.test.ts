import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:https";
import { once } from "node:events";
import { createAuditHttpsServer, type AuditServerConfig } from "../src/server.js";
import { readProviderTls } from "../src/tls.js";
import { context, csv, now, origin, service, signBytes } from "./paid-fixtures.js";
import { endpointHash } from "../../../packages/near-sdk/src/directory.js";
import { verifyInvoiceSignature } from "../../../packages/near-sdk/src/codec.js";
let directory: string, keyFile: string, certFile: string, cert: Buffer;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "agenttrust-tls-"));
  keyFile = join(directory, "localhost.key"); certFile = join(directory, "localhost.crt");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", keyFile, "-out", certFile], { stdio: "ignore" });
  await chmod(keyFile, 0o600); cert = await readFile(certFile);
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
function config(): AuditServerConfig {
  return { network: "near:testnet", core_account: "core.testnet", offer: { service, origin, amount_yocto: "10" }, sign: signBytes, nowNs: () => now,
    reader: { network: "near:testnet", coreAccount: "core.testnet", getPaymentSnapshot: async () => { throw new Error("UNEXPECTED_CHAIN_CALL"); }, resolveSubmission: async () => { throw new Error("UNEXPECTED_CHAIN_CALL"); } } };
}
describe("local HTTPS provider", () => {
  it("requires explicit absolute local TLS files and matching origin port", async () => {
    const tls = await readProviderTls({ cert_file: certFile, key_file: keyFile }, "https://localhost:4041", 4041);
    expect(tls.cert.equals(cert)).toBe(true);
    for (const [input, configuredOrigin, port] of [
      [{ cert_file: "relative.crt", key_file: keyFile }, "https://localhost:4041", 4041],
      [{ cert_file: certFile, key_file: keyFile, insecure: true }, "https://localhost:4041", 4041],
      [{ cert_file: certFile, key_file: keyFile }, "http://localhost:4041", 4041],
      [{ cert_file: certFile, key_file: keyFile }, "https://localhost:4042", 4041],
      [{ cert_file: certFile, key_file: keyFile }, "https://other.example:4041", 4041],
    ] as const) await expect(readProviderTls(input, configuredOrigin, port)).rejects.toThrow();
    await chmod(keyFile, 0o644);
    try { await expect(readProviderTls({ cert_file: certFile, key_file: keyFile }, "https://localhost:4041", 4041)).rejects.toThrow("UNSAFE_TLS_KEY"); }
    finally { await chmod(keyFile, 0o600); }
  });
  it("serves a real signed quote only over trusted TLS and exposes read-only configured health", async () => {
    const settings = config();
    const server = createAuditHttpsServer(settings, { cert, key: await readFile(keyFile) });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address(); if (!address || typeof address === "string") throw new Error("NO_PORT");
    const call = (path: string, trusted: boolean, servername = "localhost", body?: unknown) => new Promise<{ status: number; json: any }>((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", servername, port: address.port, path, method: body ? "POST" : "GET", ...(trusted ? { ca: cert } : {}), headers: { "content-type": "application/json" } }, res => {
        const chunks: Buffer[] = []; res.on("data", c => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode!, json: JSON.parse(Buffer.concat(chunks).toString()) }));
      }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
    });
    try {
      await expect(call("/health", false)).rejects.toThrow();
      await expect(call("/health", true, "wrong.example")).rejects.toThrow();
      const health = await call("/health", true);
      expect(health.status).toBe(200); expect(health.json).toMatchObject({ status: "configured", network: "near:testnet", chain_verification: "not_checked", service_id: service.service_id, endpoint_hash: endpointHash(origin) });
      const quote = await call("/v1/invoice-audit", true, "localhost", { mode: "quote", csv_utf8: csv, context });
      expect(quote.status).toBe(402); expect(verifyInvoiceSignature(quote.json.quote, service.invoice_key)).toBe(true);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
