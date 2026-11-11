/** Wire integers and binary fields are strings; their validation is in codec.ts. */
export type AccountId = string;
export type Hash32 = string;
export type PublicKey32 = string;
export type Signature64 = string;
export type U128String = string;
export type U64String = string;

export interface InvoiceV1 {
  schema_version: 1;
  network: "near:testnet";
  core_account: AccountId;
  owner_id: AccountId;
  session_id: Hash32;
  payment_id: Hash32;
  policy_revision: number;
  profile_id: string;
  profile_revision: number;
  service_id: AccountId;
  service_version: number;
  payout_account: AccountId;
  endpoint_hash: Hash32;
  request_hash: Hash32;
  asset: "NEAR";
  amount_yocto: U128String;
  issued_at_ns: U64String;
  expires_at_ns: U64String;
}

export interface SignedInvoiceV1 {
  invoice: InvoiceV1;
  signature: Signature64;
}

export interface IdentityDescriptorV1 {
  schema_version: 1;
  network: "near:testnet";
  core_account: AccountId;
  challenge_nonce: Hash32;
  service_id: AccountId;
  service_version: number;
  payout_account: AccountId;
  endpoint_hash: Hash32;
  invoice_key: PublicKey32;
  issued_at_ns: U64String;
  expires_at_ns: U64String;
}
