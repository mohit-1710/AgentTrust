/** Owner/merchant/issuer operations live in a separate package entrypoint; never expose these as worker tools. */
import { Account, PublicKey, actions, baseEncode, type Action, type Signer } from "near-api-js";
import { AgentTrustClient, bounded, CALL_GAS, type BroadcastOptions } from "./client.js";
import { validateAccountId, validateHash32, validateProfileId, validateU128 } from "./codec.js";
import type * as V from "./views.js";
export type OwnerSubmission<T> = { kind: "final"; transaction: V.TransactionLocator; value: T; receipt_ids: string[] } |
  { kind: "uncertain"; transaction: V.TransactionLocator } | { kind: "failed"; transaction: V.TransactionLocator; error: unknown };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export class AgentTrustOwner {
  private readonly account: Account;
  constructor(readonly client: AgentTrustClient, readonly ownerId: string, private readonly signer: Signer) {
    validateAccountId(ownerId); this.account = new Account(ownerId, client.provider, signer);
  }
  private async submit<T>(receiverId: string, transactionActions: Action[], options: BroadcastOptions): Promise<OwnerSubmission<T>> {
    await this.client.getConfig();
    const publicKey = await bounded(this.signer.getPublicKey());
    const key = await bounded(this.client.provider.viewAccessKey({ accountId: this.ownerId, publicKey, finalityQuery: { finality: "final" } }));
    if (key.permission !== "FullAccess") throw new Error("OWNER_FULL_ACCESS_KEY_REQUIRED");
    const tx = await bounded(this.account.createTransaction({ receiverId, actions: transactionActions, publicKey }));
    const signed = await bounded(this.signer.signTransaction(tx));
    const transaction = Object.freeze({ tx_hash: baseEncode(signed.txHash), sender_account_id: this.ownerId });
    await options.beforeBroadcast?.(transaction);
    try {
      const raw: unknown = await bounded(this.client.provider.sendTransactionUntil(signed.signedTransaction, "FINAL"));
      if (!object(raw) || raw.final_execution_status !== "FINAL" || !object(raw.transaction) || raw.transaction.hash !== transaction.tx_hash || raw.transaction.signer_id !== this.ownerId || raw.transaction.receiver_id !== receiverId || !object(raw.status)) return { kind: "uncertain", transaction };
      if ("Failure" in raw.status) return { kind: "failed", transaction, error: raw.status.Failure };
      if (typeof raw.status.SuccessValue !== "string" || !Array.isArray(raw.receipts_outcome)) return { kind: "uncertain", transaction };
      const encoded = raw.status.SuccessValue, bytes = Buffer.from(encoded, "base64");
      if (bytes.length > 512 * 1024 || bytes.toString("base64") !== encoded) return { kind: "uncertain", transaction };
      const value = (encoded === "" ? null : JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes))) as T;
      const receipt_ids = raw.receipts_outcome.map((receipt) => { if (!object(receipt) || typeof receipt.id !== "string") throw new Error("INVALID_RECEIPT"); return receipt.id; });
      return { kind: "final", transaction, value, receipt_ids };
    } catch { return { kind: "uncertain", transaction }; }
  }
  private call<T>(method: string, args: object, deposit = 1n, options: BroadcastOptions = {}): Promise<OwnerSubmission<T>> {
    return this.submit(this.client.coreAccount, [actions.functionCall(method, structuredClone(args), CALL_GAS, deposit)], options);
  }
  async deposit(amountYocto: string, storageCreditYocto: string, options: BroadcastOptions = {}): Promise<OwnerSubmission<V.AccountLedgerView>> {
    validateU128(amountYocto); validateU128(storageCreditYocto);
    if (BigInt(amountYocto) === 0n || BigInt(storageCreditYocto) > BigInt(amountYocto)) throw new Error("INVALID_DEPOSIT");
    return this.call("deposit", { storage_credit_yocto: storageCreditYocto }, BigInt(amountYocto), options);
  }
  setPolicy(args: { expected_revision: number; daily_cap_yocto: string; max_dispatches_per_minute: number; paused: boolean }): Promise<OwnerSubmission<V.OwnerPolicyView>> {
    validateU128(args.daily_cap_yocto); return this.call("set_policy", args);
  }
  setProfile(args: { profile_id: string; expected_revision: number | null; requirement: V.CapabilityRequirement | null }): Promise<OwnerSubmission<V.ProfileView>> {
    validateProfileId(args.profile_id); return this.call("set_profile", args);
  }
  registerSession(args: Omit<V.SessionView, "owner_id" | "revoked">): Promise<OwnerSubmission<V.SessionView>> {
    validateHash32(args.session_id); validateProfileId(args.profile_id); PublicKey.from(args.public_key);
    validateU128(args.purchase_cap_yocto); return this.call("register_session", args);
  }
  revokeSession(sessionId: string): Promise<OwnerSubmission<V.SessionView>> { validateHash32(sessionId); return this.call("revoke_session", { session_id: sessionId }); }
  setServiceTrust(args: { service_id: string; service_version: number; allowed_profile_ids: string[]; expires_at_ns: string | null; active: boolean }): Promise<OwnerSubmission<V.TrustEntry & { owner_id: string }>> {
    validateAccountId(args.service_id); return this.call("set_service_trust", args);
  }
  blockService(serviceId: string, blocked: boolean): Promise<OwnerSubmission<null>> { validateAccountId(serviceId); return this.call("block_service", { service_id: serviceId, blocked }); }
  blockPayout(payoutAccount: string, blocked: boolean): Promise<OwnerSubmission<null>> { validateAccountId(payoutAccount); return this.call("block_payout", { payout_account: payoutAccount, blocked }); }
  setService(args: { expected_version: number | null; payout_account: string; invoice_key: string; endpoint_hash: string; active: boolean }): Promise<OwnerSubmission<V.ServiceView>> {
    validateAccountId(args.payout_account); validateHash32(args.invoice_key); validateHash32(args.endpoint_hash); return this.call("set_service", args);
  }
  issueCredential(args: { credential_id: string; expected_revision: number | null; assertion: V.CredentialAssertion }): Promise<OwnerSubmission<V.CredentialView>> {
    validateHash32(args.credential_id); return this.call("issue_credential", args);
  }
  revokeCredential(credentialId: string): Promise<OwnerSubmission<V.CredentialView>> { validateHash32(credentialId); return this.call("revoke_credential", { credential_id: credentialId }); }
  withdrawAvailable(withdrawalId: string, amountYocto: string, options: BroadcastOptions = {}): Promise<OwnerSubmission<V.WithdrawalView>> {
    validateHash32(withdrawalId); validateU128(amountYocto); return this.call("withdraw_available", { withdrawal_id: withdrawalId, amount_yocto: amountYocto }, 1n, options);
  }
  async installWorkerKey(publicKey: string, allowanceYocto: string): Promise<OwnerSubmission<null>> {
    validateU128(allowanceYocto); if (BigInt(allowanceYocto) === 0n) throw new Error("INVALID_ALLOWANCE");
    return this.submit(this.ownerId, [actions.addFunctionCallAccessKey(PublicKey.from(publicKey), this.client.coreAccount, ["execute_payment"], BigInt(allowanceYocto))], {});
  }
  removeWorkerKey(publicKey: string): Promise<OwnerSubmission<null>> { return this.submit(this.ownerId, [actions.deleteKey(PublicKey.from(publicKey))], {}); }
}
