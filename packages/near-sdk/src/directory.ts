import { createHash } from "node:crypto";
import { validateAccountId, validateHash32 } from "./codec.js";
import type { InvoiceV1 } from "./types.js";
import type { ServiceView } from "./views.js";
export interface CatalogEntry { service_id: string; service_version: number; origin: string }

/** Only operator configuration supplies origins; an endpoint hash is not discovery. */
export function canonicalOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (typeof origin !== "string" || parsed.protocol !== "https:" || parsed.origin !== origin ||
      !/^[\x21-\x7e]+$/.test(origin) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError("INVALID_ORIGIN");
  }
  return origin;
}
export function endpointHash(origin: string): string {
  return createHash("sha256").update(`agenttrust-http402-v1\nPOST\n${canonicalOrigin(origin)}\n/v1/invoice-audit\n`, "utf8").digest("base64");
}
export class ServiceDirectory {
  readonly entries: readonly Readonly<CatalogEntry>[];
  constructor(entries: readonly CatalogEntry[]) {
    if (entries.length > 128) throw new TypeError("CATALOG_CAPACITY");
    const seen = new Set<string>();
    this.entries = Object.freeze(entries.map((entry) => {
      validateAccountId(entry.service_id);
      if (!Number.isInteger(entry.service_version) || entry.service_version < 1 || entry.service_version > 0xffffffff) throw new TypeError("INVALID_SERVICE_VERSION");
      const key = `${entry.service_id}/${entry.service_version}`;
      if (seen.has(key)) throw new TypeError("DUPLICATE_CATALOG_ENTRY");
      seen.add(key);
      return Object.freeze({ ...entry, origin: canonicalOrigin(entry.origin) });
    }));
  }
  private resolve(serviceId: string, version: number, hash: string): string {
    validateAccountId(serviceId); validateHash32(hash);
    const entry = this.entries.find((item) => item.service_id === serviceId && item.service_version === version);
    if (!entry) throw new Error("ENDPOINT_UNCONFIGURED");
    if (endpointHash(entry.origin) !== hash) throw new Error("ENDPOINT_MISMATCH");
    return entry.origin;
  }
  forNewPurchase(service: ServiceView): string {
    if (service.active !== true) throw new Error("INACTIVE_SERVICE");
    return this.resolve(service.service_id, service.version, service.endpoint_hash);
  }
  /** Caller must already establish final settlement; expiry/current registry are irrelevant to retrieval. */
  forSettledInvoice(invoice: InvoiceV1): string {
    return this.resolve(invoice.service_id, invoice.service_version, invoice.endpoint_hash);
  }
  isConfigured(service: ServiceView): boolean {
    try { this.resolve(service.service_id, service.version, service.endpoint_hash); return true; }
    catch { return false; }
  }
}
