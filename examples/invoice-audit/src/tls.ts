import { X509Certificate } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { canonicalOrigin } from "../../../packages/near-sdk/src/directory.js";
import { exactFields } from "../../../packages/near-sdk/src/paid-protocol.js";

/** Local operator configuration only; no caller-controlled paths or trust-store changes. */
export async function readProviderTls(value: unknown, origin: string, port: number): Promise<{ cert: Buffer; key: Buffer }> {
  if (!exactFields(value, ["cert_file", "key_file"]) || typeof value.cert_file !== "string" || typeof value.key_file !== "string" ||
      !isAbsolute(value.cert_file) || !isAbsolute(value.key_file)) throw new Error("INVALID_TLS_CONFIG");
  const url = new URL(canonicalOrigin(origin));
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || Number(url.port || "443") !== port) throw new Error("TLS_ORIGIN_MISMATCH");
  async function read(path: string, privateKey: boolean): Promise<Buffer> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size === 0 || stat.size > 64 * 1024) throw new Error("INVALID_TLS_FILE");
      if (privateKey && ((stat.mode & 0o077) !== 0 || process.getuid && stat.uid !== process.getuid())) throw new Error("UNSAFE_TLS_KEY");
      const bytes = await file.readFile();
      if (bytes.length > 64 * 1024) throw new Error("INVALID_TLS_FILE");
      return bytes;
    } finally { await file.close(); }
  }
  const cert = await read(value.cert_file, false), key = await read(value.key_file, true);
  const certificate = new X509Certificate(cert);
  const matched = url.hostname === "127.0.0.1" ? certificate.checkIP(url.hostname) : certificate.checkHost(url.hostname);
  if (!matched || Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now()) throw new Error("TLS_CERTIFICATE_MISMATCH");
  return { cert, key }; // Node's TLS context also verifies that key and certificate match.
}
