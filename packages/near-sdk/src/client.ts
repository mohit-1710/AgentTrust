import { Account, JsonRpcProvider, actions, baseEncode, type Signer } from "near-api-js";
import { encodeIdentityDescriptor, validateAccountId, validateHash32, validateProfileId, validateSignedInvoice, validateU64, validateU128 } from "./codec.js";
import { ServiceDirectory, type CatalogEntry } from "./directory.js";
import { assertRestrictedWorkerKey, finalAdmission, observePayment, validateDecision, validatePayment } from "./finality.js";
import type * as V from "./views.js";
import { payService, type PaidAuditResult, type PayServiceArgs, type PurchaseOptions } from "./pay-service.js";

export interface ClientOptions {
  network: "near:testnet"; coreAccount: string; rpcUrl: string; catalog?: readonly CatalogEntry[];
  worker?: { ownerId: string; signer: Signer };
  purchase?: PurchaseOptions;
}
export interface BroadcastOptions { beforeBroadcast?: (transaction: V.TransactionLocator) => Promise<void> }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const u32 = (value: unknown): boolean => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
export const CALL_GAS = 150_000_000_000_000n;

/** A timeout never cancels an already submitted transaction or implies nonpayment. */
export async function bounded<T>(pending: Promise<T>, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("RPC_TIMEOUT")), timeoutMs);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function validatePage(cursor: string | null, limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new TypeError("INVALID_PAGE_LIMIT");
  if (cursor !== null) validateU64(cursor);
}
function page<T>(value: unknown, limit: number, parse: (item: unknown) => T): V.Page<T> {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > limit || !(value.next_cursor === null || typeof value.next_cursor === "string")) throw new TypeError("INVALID_PAGE");
  if (value.next_cursor !== null) validateU64(value.next_cursor);
  return { items: value.items.map(parse), next_cursor: value.next_cursor };
}
function service(value: unknown, expectedId?: string): V.ServiceView {
  if (!object(value) || typeof value.active !== "boolean" || !u32(value.version) || (value.version as number) < 1 || expectedId !== undefined && value.service_id !== expectedId) throw new TypeError("INVALID_SERVICE");
  const s = value as unknown as V.ServiceView;
  encodeIdentityDescriptor({ schema_version: 1, network: "near:testnet", core_account: "core.testnet", challenge_nonce: Buffer.alloc(32).toString("base64"),
    service_id: s.service_id, service_version: s.version, payout_account: s.payout_account, invoice_key: s.invoice_key, endpoint_hash: s.endpoint_hash, issued_at_ns: "0", expires_at_ns: "1" });
  return s;
}
function credentialRef(value: V.CredentialRef | null): void {
  if (value === null) return;
  if (!object(value) || Object.keys(value).length !== 3 || !u32(value.revision)) throw new TypeError("INVALID_CREDENTIAL_REF");
  validateAccountId(value.issuer_id); validateHash32(value.credential_id);
}

/** Local SDK. Read methods never need a signer; only executePayment accesses the restricted worker. */
export class AgentTrustClient {
  readonly provider: JsonRpcProvider;
  readonly coreAccount: string;
  readonly network: "near:testnet";
  readonly directory: ServiceDirectory;
  private readonly worker: ClientOptions["worker"];
  private readonly workerAccount: Account | undefined;
  private domainCheck: Promise<V.CoreConfig> | undefined;
  private readonly purchaseOptions: PurchaseOptions | undefined;
  constructor(options: ClientOptions) {
    if (options.network !== "near:testnet") throw new TypeError("DOMAIN_MISMATCH");
    validateAccountId(options.coreAccount);
    const rpc = new URL(options.rpcUrl);
    if (rpc.username || rpc.password || !(rpc.protocol === "https:" || rpc.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(rpc.hostname))) throw new TypeError("INVALID_RPC_URL");
    this.provider = new JsonRpcProvider({ url: options.rpcUrl }, { retries: 1 }); // One attempt, including broadcasts.
    this.coreAccount = options.coreAccount; this.network = options.network;
    this.directory = new ServiceDirectory(options.catalog ?? []);
    this.purchaseOptions = options.purchase ? structuredClone(options.purchase) : undefined;
    this.worker = options.worker ? Object.freeze({ ...options.worker }) : undefined;
    if (options.worker) {
      validateAccountId(options.worker.ownerId);
      this.workerAccount = new Account(options.worker.ownerId, this.provider, options.worker.signer);
    }
  }
  async payService(args: PayServiceArgs): Promise<PaidAuditResult> {
    if (!this.purchaseOptions) throw new Error("PURCHASE_NOT_CONFIGURED");
    return payService(this, this.purchaseOptions, args);
  }
  private async rawView<T>(method: string, args: object): Promise<V.FinalSnapshot<T>> {
    const value: unknown = await bounded(this.provider.sendJsonRpc("query", { request_type: "call_function", account_id: this.coreAccount,
      method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64"), finality: "final" }));
    if (!object(value) || !Array.isArray(value.result) || value.result.length > 512 * 1024 || value.result.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255) ||
        typeof value.block_hash !== "string" || !value.block_hash || !Number.isSafeInteger(value.block_height) || (value.block_height as number) < 0) throw new TypeError("INVALID_FINAL_VIEW");
    const decoded = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(Uint8Array.from(value.result))) as T;
    return { value: decoded, block: { finality: "final", block_hash: value.block_hash, block_height: value.block_height as number } };
  }
  async getConfig(): Promise<V.CoreConfig> {
    this.domainCheck ??= (async () => {
      const [status, snapshot] = await Promise.all([bounded(this.provider.sendJsonRpc("status", [])), this.rawView<V.CoreConfig>("get_config", {})]);
      if (status.chain_id !== "testnet" || snapshot.value.network !== this.network || snapshot.value.core_account !== this.coreAccount) throw new Error("DOMAIN_MISMATCH");
      validateU128(snapshot.value.operating_reserve_yocto);
      return snapshot.value;
    })().catch((error: unknown) => { this.domainCheck = undefined; throw error; });
    return this.domainCheck;
  }
  private async view<T>(method: string, args: object): Promise<V.FinalSnapshot<T>> { await this.getConfig(); return this.rawView<T>(method, args); }
  async getAccount(accountId: string): Promise<V.AccountLedgerView | null> {
    validateAccountId(accountId);
    const value = (await this.view<V.AccountLedgerView | null>("get_account", { account_id: accountId })).value;
    if (value && value.account_id !== accountId) throw new Error("ACCOUNT_BINDING_MISMATCH");
    return value;
  }
  async getPolicy(ownerId: string): Promise<V.OwnerPolicyView | null> {
    validateAccountId(ownerId);
    const value = (await this.view<V.OwnerPolicyView | null>("get_policy", { owner_id: ownerId })).value;
    if (value && (value.owner_id !== ownerId || !Array.isArray(value.trusted_services) || value.trusted_services.length > 32 || !Array.isArray(value.blocked_services) || value.blocked_services.length > 32 || !Array.isArray(value.blocked_payouts) || value.blocked_payouts.length > 32)) throw new TypeError("INVALID_POLICY");
    return value;
  }
  async getProfile(ownerId: string, profileId: string): Promise<V.ProfileView | null> {
    validateAccountId(ownerId); validateProfileId(profileId);
    const value = (await this.view<V.ProfileView | null>("get_profile", { owner_id: ownerId, profile_id: profileId })).value;
    if (value && (value.owner_id !== ownerId || value.profile_id !== profileId)) throw new Error("PROFILE_BINDING_MISMATCH");
    return value;
  }
  async getSession(ownerId: string, sessionId: string): Promise<V.SessionView | null> {
    validateAccountId(ownerId); validateHash32(sessionId);
    const value = (await this.view<V.SessionView | null>("get_session", { owner_id: ownerId, session_id: sessionId })).value;
    if (value && (value.owner_id !== ownerId || value.session_id !== sessionId)) throw new Error("SESSION_BINDING_MISMATCH");
    return value;
  }
  async getService(serviceId: string): Promise<V.ServiceView | null> {
    validateAccountId(serviceId);
    const value = (await this.view<unknown>("get_service", { service_id: serviceId })).value;
    return value === null ? null : service(value, serviceId);
  }
  async getCredential(issuerId: string, credentialId: string): Promise<V.CredentialView | null> {
    validateAccountId(issuerId); validateHash32(credentialId);
    const value = (await this.view<V.CredentialView | null>("get_credential", { issuer_id: issuerId, credential_id: credentialId })).value;
    if (value && (value.issuer_id !== issuerId || value.credential_id !== credentialId)) throw new Error("CREDENTIAL_BINDING_MISMATCH");
    return value;
  }
  async getWithdrawal(ownerId: string, withdrawalId: string): Promise<V.WithdrawalView | null> {
    validateAccountId(ownerId); validateHash32(withdrawalId);
    const value = (await this.view<V.WithdrawalView | null>("get_withdrawal", { owner_id: ownerId, withdrawal_id: withdrawalId })).value;
    if (value && (value.owner_id !== ownerId || value.withdrawal_id !== withdrawalId)) throw new Error("WITHDRAWAL_BINDING_MISMATCH");
    return value;
  }
  async getPaymentSnapshot(owner: string, id: string): Promise<V.FinalSnapshot<V.PaymentView | null>> {
    validateAccountId(owner); validateHash32(id);
    const snapshot = await this.view<unknown>("get_payment", { owner_id: owner, payment_id: id });
    return { ...snapshot, value: validatePayment(snapshot.value, this.network, this.coreAccount, owner, id) };
  }
  async getPayment(owner: string, id: string): Promise<V.PaymentView | null> { return (await this.getPaymentSnapshot(owner, id)).value; }
  async previewPayment(args: V.ExecutePaymentArgs): Promise<V.PreviewResult> {
    this.validateArgs(args);
    const { value } = await this.view<V.PreviewResult>("preview_payment", args);
    if (value.authorization !== "not_proven_by_view") throw new Error("INVALID_PREVIEW");
    return { authorization: "not_proven_by_view", decision: validateDecision(value.decision) };
  }
  async listServices(cursor: string | null = null, limit = 20): Promise<V.Page<V.ServiceView & { registered: true; configured: boolean; eligibility: "not_evaluated" }>> {
    validatePage(cursor, limit);
    const { value } = await this.view<unknown>("list_services", { cursor, limit });
    return page(value, limit, (item) => { const s = service(item); return { ...s, registered: true, configured: this.directory.isConfigured(s), eligibility: "not_evaluated" }; });
  }
  async listRecentPayments(ownerId: string, cursor: string | null = null, limit = 20): Promise<V.Page<V.PaymentView>> {
    validateAccountId(ownerId); validatePage(cursor, limit);
    const { value } = await this.view<unknown>("list_recent_payments", { owner_id: ownerId, cursor, limit });
    return page(value, limit, (item) => {
      if (!object(item) || !object(item.invoice)) throw new TypeError("INVALID_PAYMENT");
      const payment = validatePayment(item, this.network, this.coreAccount, ownerId, item.invoice.payment_id as string);
      if (!payment) throw new TypeError("INVALID_PAYMENT"); return payment;
    });
  }
  async awaitPayment(owner: string, id: string, timeoutMs: number): Promise<V.PaymentObservation> {
    validateAccountId(owner); validateHash32(id);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 300_000) throw new TypeError("INVALID_TIMEOUT");
    const deadline = Date.now() + timeoutMs;
    let last: V.PaymentObservation = { kind: "uncertain", owner_id: owner, payment_id: id, reason: "rpc_unavailable" };
    do {
      try {
        const snapshot = await bounded(this.getPaymentSnapshot(owner, id), timeoutMs === 0 ? 10_000 : Math.max(1, Math.min(10_000, deadline - Date.now())));
        last = observePayment(snapshot, owner, id);
        if (last.kind !== "uncertain") return last;
      } catch {
        // Network failures never turn unknown/pending into unpaid or failed.
        if (last.kind === "uncertain") last = { ...last, reason: "rpc_unavailable" };
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(500, remaining)));
    } while (Date.now() < deadline);
    return last;
  }
  private validateArgs(args: V.ExecutePaymentArgs): void {
    validateSignedInvoice(args.quote); credentialRef(args.credential);
    if (args.quote.invoice.network !== this.network || args.quote.invoice.core_account !== this.coreAccount) throw new Error("DOMAIN_MISMATCH");
  }
  async resolveSubmission(transaction: V.TransactionLocator, args: V.ExecutePaymentArgs): Promise<V.SubmissionResult> {
    args = structuredClone(args);
    this.validateArgs(args); await this.getConfig();
    if (transaction.sender_account_id !== args.quote.invoice.owner_id) throw new Error("PAYMENT_BINDING_MISMATCH");
    try {
      // Alias remains supported on old and current nodes and preserves raw finality/receipt data.
      const raw: unknown = await bounded(this.provider.sendJsonRpc("EXPERIMENTAL_tx_status", { ...transaction, wait_until: "FINAL" }));
      const result = finalAdmission(raw, transaction, this.coreAccount, args);
      if (result) return { kind: "final", transaction, ...result };
      return { kind: "uncertain", transaction, reason: object(raw) && raw.final_execution_status === "FINAL" ? "unresolved_execution" : "not_final" };
    } catch { return { kind: "uncertain", transaction, reason: "broadcast_or_rpc_error" }; }
  }
  async executePayment(args: V.ExecutePaymentArgs, options: BroadcastOptions = {}): Promise<V.SubmissionResult> {
    args = structuredClone(args);
    this.validateArgs(args); await this.getConfig();
    const worker = this.worker;
    if (!worker || !this.workerAccount) throw new Error("WORKER_NOT_CONFIGURED");
    if (args.quote.invoice.owner_id !== worker.ownerId) throw new Error("OWNER_MISMATCH");
    const publicKey = await bounded(worker.signer.getPublicKey());
    const key = await bounded(this.provider.viewAccessKey({ accountId: worker.ownerId, publicKey, finalityQuery: { finality: "final" } }));
    assertRestrictedWorkerKey(key.permission, this.coreAccount);
    const tx = await bounded(this.workerAccount.createTransaction({ receiverId: this.coreAccount, publicKey, actions: [actions.functionCall("execute_payment", args, CALL_GAS, 0n)] }));
    const signed = await bounded(worker.signer.signTransaction(tx));
    const transaction = Object.freeze({ tx_hash: baseEncode(signed.txHash), sender_account_id: worker.ownerId });
    // The caller can durably record the locator before the first broadcast. A
    // failed checkpoint propagates, so no send is attempted.
    await options.beforeBroadcast?.(transaction);
    try {
      await bounded(this.provider.sendTransactionUntil(signed.signedTransaction, "INCLUDED"));
    } catch { return { kind: "uncertain", transaction, reason: "broadcast_or_rpc_error" }; }
    return this.resolveSubmission(transaction, args);
  }
}
