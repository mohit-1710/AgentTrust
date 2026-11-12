import type { AccountId, Hash32, InvoiceV1, SignedInvoiceV1, U64String, U128String } from "./types.js";

export interface CoreConfig { network: "near:testnet"; core_account: AccountId; operating_reserve_yocto: U128String }
export interface CapabilityRequirement {
  capability_namespace: "invoice.audit"; capability_version: 1;
  conformance_suite_version: number; conformance_suite_hash: Hash32; accepted_issuers: AccountId[];
}
export interface TrustEntry {
  service_id: AccountId; service_version: number; payout_account: AccountId;
  invoice_key: Hash32; endpoint_hash: Hash32; allowed_profile_ids: string[];
  expires_at_ns: U64String | null; active: boolean;
}
export interface OwnerPolicyView {
  owner_id: AccountId; revision: number; paused: boolean; daily_cap_yocto: U128String;
  max_dispatches_per_minute: number; trusted_services: TrustEntry[]; blocked_services: AccountId[]; blocked_payouts: AccountId[];
}
export interface ProfileView { owner_id: AccountId; profile_id: string; revision: number; requirement: CapabilityRequirement | null }
export interface SessionView {
  owner_id: AccountId; session_id: Hash32; public_key: string; profile_id: string; profile_revision: number;
  purchase_cap_yocto: U128String; expires_at_ns: U64String; revoked: boolean;
}
export interface ServiceView {
  service_id: AccountId; version: number; payout_account: AccountId; invoice_key: Hash32; endpoint_hash: Hash32; active: boolean;
}
export interface CredentialRef { issuer_id: AccountId; credential_id: Hash32; revision: number }
export interface CredentialAssertion {
  service_id: AccountId; service_version: number; capability_namespace: "invoice.audit"; capability_version: 1;
  conformance_suite_version: number; conformance_suite_hash: Hash32; evidence_manifest_hash: Hash32;
  issued_at_ns: U64String; expires_at_ns: U64String;
}
export interface CredentialView extends CredentialAssertion, CredentialRef { revoked: boolean }
export interface AccountLedgerView {
  account_id: AccountId; available_yocto: U128String; storage_credit_yocto: U128String;
  pending_payment_yocto: U128String; storage_charged_bytes: U64String;
  vault: {
    total_available_yocto: U128String; total_storage_credit_yocto: U128String;
    operating_reserve_yocto: U128String; runtime_account_balance_yocto: U128String;
    storage_usage_bytes: U64String; storage_byte_cost_yocto: U128String;
  };
  usage: {
    current_day: U64String; settled_current_day_yocto: U128String; dispatch_minute: U64String;
    dispatched_in_minute: number; outstanding_transfers: number; retained_payments: number;
  };
}
export type DenialCode = "UNAUTHORIZED" | "SESSION_REVOKED" | "SESSION_EXPIRED" | "PAUSED" | "PROFILE_MISMATCH" |
  "POLICY_CHANGED" | "DOMAIN_MISMATCH" | "INVALID_INVOICE" | "INVOICE_EXPIRED" | "IDENTITY_CHANGED" | "BLOCKED_SERVICE" |
  "BLOCKED_PAYOUT" | "PURCHASE_CAP" | "DAILY_CAP" | "RATE_LIMIT" | "INSUFFICIENT_FUNDS" | "INSUFFICIENT_BACKING" |
  "STORAGE_CREDIT" | "CAPACITY" | "UNKNOWN_SERVICE" | "PAYMENT_ID_CONFLICT";
export type CredentialFailure = "MISSING" | "UNACCEPTED_ISSUER" | "WRONG_SUBJECT" | "WRONG_SCOPE" | "WRONG_SUITE" | "EXPIRED" | "REVOKED" | "REVISION_CHANGED";
export type Decision = { kind: "allow" } | { kind: "deny"; code: DenialCode; retry_after_ns?: U64String } |
  { kind: "require_validation"; code: CredentialFailure; requirement: CapabilityRequirement };
export interface PreviewResult { authorization: "not_proven_by_view"; decision: Decision }
export interface ExecutePaymentArgs { quote: SignedInvoiceV1; credential: CredentialRef | null }
export type PaymentState = "pending" | "settled" | "failed";
export interface PaymentView {
  invoice: InvoiceV1; invoice_hash: Hash32; credential: CredentialRef | null;
  dispatched_at_ns: U64String; dispatch_day: U64String; dispatch_minute: U64String;
  state: PaymentState; finalized_at_ns: U64String;
  display_state: PaymentState | "needs_reconciliation";
}
export interface WithdrawalView {
  owner_id: AccountId; payout_account: AccountId; withdrawal_id: Hash32; amount_yocto: U128String; dispatched_at_ns: U64String;
  state: "pending" | "succeeded" | "failed"; finalized_at_ns: U64String;
  display_state: "pending" | "succeeded" | "failed" | "needs_reconciliation";
}
export interface Page<T> { items: T[]; next_cursor: U64String | null }
export type ExecutionResult = { kind: "rejected"; decision: Exclude<Decision, { kind: "allow" }> } |
  { kind: "payment"; payment: PaymentView; duplicate: boolean };
export interface FinalBlock { finality: "final"; block_hash: string; block_height: number }
export interface FinalSnapshot<T> { value: T; block: FinalBlock }
export interface TransactionLocator { tx_hash: string; sender_account_id: AccountId }
export type PaymentObservation =
  { kind: "settled" | "failed"; payment: PaymentView; block: FinalBlock } |
  { kind: "uncertain"; owner_id: AccountId; payment_id: Hash32; reason: "not_found" | "pending" | "rpc_unavailable"; payment?: PaymentView; block?: FinalBlock };
export type SubmissionResult =
  { kind: "final"; transaction: TransactionLocator; admission: ExecutionResult; receipt_ids: string[] } |
  { kind: "uncertain"; transaction: TransactionLocator; reason: "not_final" | "broadcast_or_rpc_error" | "unresolved_execution" };
