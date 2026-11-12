import type { PaymentView } from "../../../packages/near-sdk/src/views.js";

/** Native NEAR has 24 decimal places. No floating-point conversion or rounding. */
export function formatNear(yocto: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(yocto) || yocto.length > 39 || BigInt(yocto) > BigInt("340282366920938463463374607431768211455")) {
    throw new TypeError("INVALID_AMOUNT");
  }
  const digits = yocto.padStart(25, "0");
  const fraction = digits.slice(-24).replace(/0+$/, "");
  return `${digits.slice(0, -24)}${fraction ? `.${fraction}` : ""} NEAR`;
}
export function accountUrl(account: string): string {
  if (account.length < 2 || account.length > 64 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(account)) throw new TypeError("INVALID_ACCOUNT");
  return `https://testnet.nearblocks.io/address/${encodeURIComponent(account)}`;
}
export function transactionUrl(hash: string): string {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash)) throw new TypeError("INVALID_TRANSACTION_HASH");
  return `https://testnet.nearblocks.io/txns/${hash}`;
}
export function paymentLabel(payment: Pick<PaymentView, "state" | "display_state">): string {
  if (payment.state === "pending") return payment.display_state === "needs_reconciliation" ? "RECONCILIATION" : "PENDING";
  return payment.state === "settled" ? "SETTLED" : "FAILED";
}
