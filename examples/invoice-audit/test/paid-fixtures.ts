import { generateKeyPairSync, sign } from "node:crypto";
import { encodeInvoice, invoiceHash, requestHash } from "../../../packages/near-sdk/src/codec.js";
import { endpointHash } from "../../../packages/near-sdk/src/directory.js";
import type { InvoiceV1, SignedInvoiceV1 } from "../../../packages/near-sdk/src/types.js";
import type { FinalBlock, PaymentView, TransactionLocator } from "../../../packages/near-sdk/src/views.js";
export const now = 1_800_000_000_000_000_000n;
export const origin = "https://audit.example";
export const csv = "vendor_id,invoice_id,amount,currency\nv1,i1,2.50,USD\nv1,i1,3.50,USD\n";
export const keys = generateKeyPairSync("ed25519");
export const invoiceKey = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
export const hash = (number: number) => Buffer.alloc(32, number).toString("base64");
export const context = { owner_id: "owner.testnet", session_id: hash(1), payment_id: hash(2), policy_revision: 1, profile_id: "audit", profile_revision: 1 };
export const service = { service_id: "merchant.testnet", version: 1, payout_account: "payee.testnet", invoice_key: invoiceKey, endpoint_hash: endpointHash(origin), active: true };
export const signBytes = (bytes: Uint8Array) => sign(null, bytes, keys.privateKey).toString("base64");
export function quote(change: Partial<InvoiceV1> = {}): SignedInvoiceV1 {
  const invoice: InvoiceV1 = { schema_version: 1, network: "near:testnet", core_account: "core.testnet", ...context, service_id: service.service_id, service_version: service.version, payout_account: service.payout_account, endpoint_hash: service.endpoint_hash, request_hash: requestHash(csv), asset: "NEAR", amount_yocto: "10", issued_at_ns: now.toString(), expires_at_ns: (now + 120_000_000_000n).toString(), ...change };
  return { invoice, signature: signBytes(encodeInvoice(invoice)) };
}
export const transaction: TransactionLocator = { tx_hash: "1".repeat(32), sender_account_id: context.owner_id };
export const block: FinalBlock = { finality: "final", block_hash: "block-hash", block_height: 100 };
export function payment(signed = quote(), state: PaymentView["state"] = "settled"): PaymentView {
  return { invoice: signed.invoice, invoice_hash: invoiceHash(signed.invoice), credential: null, dispatched_at_ns: now.toString(), dispatch_day: "0", dispatch_minute: "0", state, finalized_at_ns: state === "pending" ? "0" : (now + 1n).toString(), display_state: state };
}
