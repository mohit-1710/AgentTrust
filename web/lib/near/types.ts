import type { InvoiceV1 } from "../../../packages/near-sdk/src/types.js";
import type { Decision, Page, PaymentView, TransactionLocator } from "../../../packages/near-sdk/src/views.js";

export type RejectedCall = {
  origin: "executed_rejection";
  invoice: InvoiceV1;
  decision: Exclude<Decision, { kind: "allow" }>;
  transaction: TransactionLocator;
  receipt_ids: string[];
};
export type DecisionsResponse =
  | { kind: "unconfigured" }
  | { kind: "error"; code: "INVALID_CONFIGURATION" | "INVALID_QUERY" | "DOMAIN_MISMATCH" | "RPC_UNAVAILABLE" }
  | {
      kind: "ready";
      origin: "final_contract_view";
      network: "near:testnet";
      core_account: string;
      owner_id: string;
      observed_at: string;
      page: Page<PaymentView>;
      rejections: RejectedCall[];
      unresolved_references: number;
    };
