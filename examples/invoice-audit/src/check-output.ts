import { isDeepStrictEqual } from "node:util";
import { AuditInputError, DEMO_CURRENCIES, readAuditCsv, type AuditReport, type RowRejectionCode } from "./audit.js";

export type OutputCheck = { ok: true } | {
  ok: false;
  code: "INPUT_INVALID" | "INPUT_HASH_MISMATCH" | "REPORT_MISMATCH" | "GOLDEN_MISMATCH";
};

/**
 * Recomputes report semantics without calling the audit engine. Syntax parsing is
 * shared; this is a consistency checker, not an independent financial audit.
 */
export function checkAuditOutput(csvUtf8: string, candidate: unknown, golden?: AuditReport): OutputCheck {
  let parsed: ReturnType<typeof readAuditCsv>;
  try { parsed = readAuditCsv(csvUtf8); } catch (error) {
    if (error instanceof AuditInputError) return { ok: false, code: "INPUT_INVALID" };
    throw error;
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
      !("input_hash" in candidate) || typeof candidate.input_hash !== "string") {
    return { ok: false, code: "REPORT_MISMATCH" };
  }
  if (candidate.input_hash !== parsed.input_hash) return { ok: false, code: "INPUT_HASH_MISMATCH" };

  const rejected_rows: AuditReport["rejected_rows"] = [];
  const accepted: { row_index: number; vendor_id: string; invoice_id: string; minor: bigint; currency: string }[] = [];
  parsed.rows.forEach((row, index) => {
    const row_index = index + 1;
    if (row.length !== 4) { rejected_rows.push({ row_index, codes: ["COLUMN_COUNT"] }); return; }
    const vendor_id = row[parsed.columns.vendor_id]!.trim();
    const invoice_id = row[parsed.columns.invoice_id]!.trim();
    const amount = row[parsed.columns.amount]!;
    const currency = row[parsed.columns.currency]!;
    const codes: RowRejectionCode[] = [];
    if (vendor_id.length === 0) codes.push("EMPTY_VENDOR_ID");
    if (invoice_id.length === 0) codes.push("EMPTY_INVOICE_ID");
    const positive = /^\+?([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(amount);
    if (!positive) codes.push(/^-[0-9]+(?:\.[0-9]{1,2})?$/.test(amount) ? "NEGATIVE_AMOUNT" : "INVALID_AMOUNT");
    if (!DEMO_CURRENCIES.some((known) => known === currency)) codes.push("UNSUPPORTED_CURRENCY");
    if (codes.length) { rejected_rows.push({ row_index, codes }); return; }
    const minor = BigInt(positive![1]! + (positive![2] ?? "").padEnd(2, "0"));
    accepted.push({ row_index, vendor_id, invoice_id, minor, currency });
  });
  const duplicate_groups: AuditReport["duplicate_groups"] = [];
  const seen = new Map<string, number[]>();
  for (const row of accepted) {
    const key = JSON.stringify([row.vendor_id, row.invoice_id]);
    const indices = seen.get(key) ?? [];
    indices.push(row.row_index);
    seen.set(key, indices);
  }
  for (const [key, row_indices] of seen) {
    if (row_indices.length > 1) {
      const [vendor_id, invoice_id] = JSON.parse(key) as [string, string];
      duplicate_groups.push({ vendor_id, invoice_id, row_indices });
    }
  }
  const currency_totals: AuditReport["currency_totals"] = [];
  for (const currency of DEMO_CURRENCIES) {
    const entries = accepted.filter((row) => row.currency === currency);
    if (entries.length === 0) continue;
    const digits = entries.reduce((sum, row) => sum + row.minor, 0n).toString().padStart(3, "0");
    currency_totals.push({ currency, amount: digits.slice(0, -2) + "." + digits.slice(-2), row_count: entries.length });
  }
  const expected: AuditReport = {
    schema_version: 1,
    capability: "invoice.audit.v1",
    input_hash: parsed.input_hash,
    row_count: parsed.rows.length,
    accepted_row_count: accepted.length,
    rejected_row_count: rejected_rows.length,
    duplicate_groups,
    rejected_rows,
    currency_totals,
    totals_basis: "all_valid_rows_including_duplicates",
    totals_are_payable: false,
  };
  if (!isDeepStrictEqual(candidate, expected)) return { ok: false, code: "REPORT_MISMATCH" };
  if (golden !== undefined && !isDeepStrictEqual(candidate, golden)) return { ok: false, code: "GOLDEN_MISMATCH" };
  return { ok: true };
}
