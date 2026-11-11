import { requestHash } from "../../../packages/near-sdk/src/codec.js";
import type { Hash32 } from "../../../packages/near-sdk/src/types.js";

export const DEMO_CURRENCIES = ["EUR", "INR", "USD"] as const;
export type Currency = typeof DEMO_CURRENCIES[number];
export type RowRejectionCode = "COLUMN_COUNT" | "EMPTY_VENDOR_ID" | "EMPTY_INVOICE_ID" | "INVALID_AMOUNT" | "NEGATIVE_AMOUNT" | "UNSUPPORTED_CURRENCY";
export type AuditErrorCode = "INVALID_INPUT" | "INPUT_TOO_LARGE" | "INVALID_UTF8" | "CSV_SYNTAX" | "INVALID_HEADER";
export class AuditInputError extends Error {
  constructor(readonly code: AuditErrorCode, message: string, readonly record_index?: number) { super(message); this.name = "AuditInputError"; }
}
export interface AuditReport {
  schema_version: 1;
  capability: "invoice.audit.v1";
  input_hash: Hash32;
  row_count: number;
  accepted_row_count: number;
  rejected_row_count: number;
  duplicate_groups: { vendor_id: string; invoice_id: string; row_indices: number[] }[];
  rejected_rows: { row_index: number; codes: RowRejectionCode[] }[];
  currency_totals: { currency: Currency; amount: string; row_count: number }[];
  totals_basis: "all_valid_rows_including_duplicates";
  totals_are_payable: false;
}
export interface ParsedAuditCsv {
  input_hash: Hash32;
  columns: Record<"vendor_id" | "invoice_id" | "amount" | "currency", number>;
  rows: string[][];
}

const COLUMNS = ["vendor_id", "invoice_id", "amount", "currency"] as const;

/** Shared syntax reader; the output checker has its own semantic calculations. */
export function readAuditCsv(csvUtf8: string): ParsedAuditCsv {
  if (typeof csvUtf8 !== "string") throw new AuditInputError("INVALID_INPUT", "CSV must be a string");
  if (Buffer.byteLength(csvUtf8, "utf8") > 64 * 1024) {
    throw new AuditInputError("INPUT_TOO_LARGE", "CSV exceeds 64KiB of UTF-8");
  }
  if (Buffer.from(csvUtf8, "utf8").toString("utf8") !== csvUtf8) {
    throw new AuditInputError("INVALID_UTF8", "CSV contains an unpaired UTF-16 surrogate");
  }
  const input_hash = requestHash(csvUtf8);
  // One initial BOM may mark the encoding; it remains part of the raw input hash.
  const source = csvUtf8.startsWith("\ufeff") ? csvUtf8.slice(1) : csvUtf8;
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let started = false;
  let state: "start" | "unquoted" | "quoted" | "closed" = "start";
  const syntaxError = (message: string): never => {
    throw new AuditInputError("CSV_SYNTAX", message, records.length);
  };
  const finishField = (): void => {
    fields.push(field);
    field = "";
    state = "start";
  };
  const finishRecord = (): void => {
    finishField();
    records.push(fields);
    fields = [];
    started = false;
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (state === "quoted") {
      if (char !== '"') field += char;
      else if (source[index + 1] === '"') { field += '"'; index++; }
      else state = "closed";
      continue;
    }
    if (char === ",") { finishField(); started = true; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r") {
        if (source[index + 1] !== "\n") syntaxError("Use LF or CRLF between records");
        index++;
      }
      finishRecord();
      continue;
    }
    if (char === '"') {
      if (state !== "start") syntaxError("Quote must begin a field");
      state = "quoted";
    } else {
      if (state === "closed") syntaxError("Only delimiter or record end may follow a closing quote");
      field += char;
      state = "unquoted";
    }
    started = true;
  }
  if (state === "quoted") syntaxError("Unterminated quoted field");
  if (started) finishRecord();
  const header = records[0];
  if (!header || header.length !== 4 || new Set(header).size !== 4 ||
      COLUMNS.some((column) => !header.includes(column))) {
    throw new AuditInputError("INVALID_HEADER", "Expected vendor_id, invoice_id, amount and currency exactly once");
  }
  const columns = Object.fromEntries(COLUMNS.map((column) => [column, header.indexOf(column)])) as ParsedAuditCsv["columns"];
  return { input_hash, columns, rows: records.slice(1) };
}

function amountMinorUnits(value: string): bigint | RowRejectionCode {
  if (!/^[+-]?[0-9]+(?:\.[0-9]{1,2})?$/.test(value)) return "INVALID_AMOUNT";
  if (value.startsWith("-")) return "NEGATIVE_AMOUNT";
  const [whole, fraction = ""] = value.replace(/^\+/, "").split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/** Structural audit only; totals are not an instruction or amount to pay. */
export function auditCsv(csvUtf8: string): AuditReport {
  const { input_hash, columns, rows } = readAuditCsv(csvUtf8);
  const rejected_rows: AuditReport["rejected_rows"] = [];
  const groups = new Map<string, AuditReport["duplicate_groups"][number]>();
  const totals = new Map<Currency, { minor: bigint; row_count: number }>();
  rows.forEach((row, index) => {
    const row_index = index + 1;
    if (row.length !== 4) {
      rejected_rows.push({ row_index, codes: ["COLUMN_COUNT"] });
      return;
    }
    const vendor_id = row[columns.vendor_id]!.trim();
    const invoice_id = row[columns.invoice_id]!.trim();
    const amount = amountMinorUnits(row[columns.amount]!);
    const currency = row[columns.currency]!;
    const codes: RowRejectionCode[] = [];
    if (!vendor_id) codes.push("EMPTY_VENDOR_ID");
    if (!invoice_id) codes.push("EMPTY_INVOICE_ID");
    if (typeof amount !== "bigint") codes.push(amount);
    if (!(DEMO_CURRENCIES as readonly string[]).includes(currency)) codes.push("UNSUPPORTED_CURRENCY");
    if (codes.length) {
      rejected_rows.push({ row_index, codes });
      return;
    }
    const key = JSON.stringify([vendor_id, invoice_id]);
    const group = groups.get(key) ?? { vendor_id, invoice_id, row_indices: [] };
    group.row_indices.push(row_index);
    groups.set(key, group);
    const prior = totals.get(currency as Currency) ?? { minor: 0n, row_count: 0 };
    totals.set(currency as Currency, { minor: prior.minor + (amount as bigint), row_count: prior.row_count + 1 });
  });
  const currency_totals = DEMO_CURRENCIES.flatMap((currency) => {
    const total = totals.get(currency);
    if (!total) return [];
    const amount = `${total.minor / 100n}.${(total.minor % 100n).toString().padStart(2, "0")}`;
    return [{ currency, amount, row_count: total.row_count }];
  });
  return {
    schema_version: 1,
    capability: "invoice.audit.v1",
    input_hash,
    row_count: rows.length,
    accepted_row_count: rows.length - rejected_rows.length,
    rejected_row_count: rejected_rows.length,
    duplicate_groups: [...groups.values()].filter((group) => group.row_indices.length > 1),
    rejected_rows,
    currency_totals,
    totals_basis: "all_valid_rows_including_duplicates",
    totals_are_payable: false,
  };
}
