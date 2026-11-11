import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AuditInputError, auditCsv, type AuditReport } from "../src/audit.js";
import { checkAuditOutput } from "../src/check-output.js";

const header = "vendor_id,invoice_id,amount,currency";
const names = ["mixed-validity", "quoted-multiline", "rejected-values", "header-only"];
const fixture = (name: string, extension: string): string => readFileSync(new URL(`../../../fixtures/invoice-audit/v1/${name}.${extension}`, import.meta.url), "utf8");
const golden = (name: string): AuditReport => JSON.parse(fixture(name, "json")) as AuditReport;
const csv = (rows: string[]): string => `${header}\n${rows.join("\n")}`;

function inputError(input: string, code: string): void {
  expect(() => auditCsv(input)).toThrow(AuditInputError);
  try { auditCsv(input); } catch (error) { expect((error as AuditInputError).code).toBe(code); }
}

describe("useful invoice CSV audit", () => {
  it.each(names)("matches manually checked golden: %s", (name) => {
    expect(auditCsv(fixture(name, "csv"))).toEqual(golden(name));
  });

  it("keeps monetary arithmetic exact above safe-number limits", () => {
    const output = auditCsv(csv(["v,one,9007199254740993.01,USD", "v,two,0.09,USD", "v,three,0.2,USD"]));
    expect(output.currency_totals).toEqual([{ currency: "USD", amount: "9007199254740993.30", row_count: 3 }]);
  });

  it("includes every valid duplicate in clearly non-payable totals", () => {
    const output = auditCsv(csv(["v,i,1.01,USD", "v,i,2.02,USD", "v,i,3.03,USD"]));
    expect(output.duplicate_groups).toEqual([{ vendor_id: "v", invoice_id: "i", row_indices: [1, 2, 3] }]);
    expect(output.currency_totals).toEqual([{ currency: "USD", amount: "6.06", row_count: 3 }]);
    expect(output.totals_basis).toBe("all_valid_rows_including_duplicates");
    expect(output.totals_are_payable).toBe(false);
  });

  it("groups only accepted rows by trimmed case-sensitive vendor plus invoice", () => {
    const output = auditCsv(csv([" v , i ,1,USD", "v,i,-1,USD", "V,i,2,USD", "v,I,3,USD", "v,i,4,USD"]));
    expect(output.duplicate_groups).toEqual([{ vendor_id: "v", invoice_id: "i", row_indices: [1, 5] }]);
    expect(output.rejected_rows).toEqual([{ row_index: 2, codes: ["NEGATIVE_AMOUNT"] }]);
  });

  it("does not collide delimiter-like IDs or normalize Unicode IDs", () => {
    const output = auditCsv(csv(["v:a,b,1,USD", "v,a:b,2,USD", "é,i,3,USD", "é,i,4,USD"]));
    expect(output.duplicate_groups).toEqual([]);
    expect(output.currency_totals[0]?.amount).toBe("10.00");
  });

  it("counts logical data records, including blank records, not physical lines", () => {
    const output = auditCsv(csv(['v,"line\nitem",1,USD', "", "v,end,2,USD"]) + "\n");
    expect(output.row_count).toBe(3);
    expect(output.accepted_row_count).toBe(2);
    expect(output.rejected_rows).toEqual([{ row_index: 2, codes: ["COLUMN_COUNT"] }]);
  });

  it("preserves exact raw bytes in the input hash while accepting one initial BOM", () => {
    const plain = csv(["v,i,1,USD"]);
    const crlf = plain.replaceAll("\n", "\r\n");
    const withBom = "\ufeff" + plain;
    const outputs = [plain, crlf, withBom].map(auditCsv);
    expect(new Set(outputs.map((report) => report.input_hash)).size).toBe(3);
    expect(outputs[1]?.currency_totals).toEqual(outputs[0]?.currency_totals);
    expect(outputs[2]?.currency_totals).toEqual(outputs[0]?.currency_totals);
  });

  it.each(["", "vendor_id,invoice_id,amount", "vendor_id,invoice_id,amount,currency,extra", "vendor_id,vendor_id,amount,currency", "Vendor_id,invoice_id,amount,currency", "vendor_id,invoice_id,amount, currency", "\ufeff\ufeff" + header])("rejects unusable header: %s", (input) => inputError(input, "INVALID_HEADER"));

  it.each(['v,in"voice,1,USD', 'v,"unterminated,1,USD', 'v,"i"tail,1,USD', 'v,"i" ,1,USD', 'v,i,1,USD\rv,next,2,USD'])("rejects malformed CSV syntax: %s", (row) => inputError(csv([row]), "CSV_SYNTAX"));

  it("reports syntax error record index separately from row rejection indices", () => {
    try { auditCsv(csv(["v,i,1,USD", 'v,"bad,1,USD'])); } catch (error) {
      expect(error).toBeInstanceOf(AuditInputError);
      expect((error as AuditInputError).record_index).toBe(2);
      return;
    }
    throw new Error("expected malformed CSV to reject");
  });

  it.each([
    ["-1", "NEGATIVE_AMOUNT"], ["-0", "NEGATIVE_AMOUNT"], ["-0.00", "NEGATIVE_AMOUNT"],
    ["1e3", "INVALID_AMOUNT"], ["1.001", "INVALID_AMOUNT"], [".50", "INVALID_AMOUNT"],
    ["1.", "INVALID_AMOUNT"], [" 1", "INVALID_AMOUNT"], ["1 ", "INVALID_AMOUNT"],
    ["NaN", "INVALID_AMOUNT"], ["Infinity", "INVALID_AMOUNT"], ["", "INVALID_AMOUNT"],
  ])("rejects invalid row amount %s without adding it to totals", (amount, code) => {
    const output = auditCsv(csv([`v,i,${amount},USD`, "v,valid,1,USD"]));
    expect(output.rejected_rows).toEqual([{ row_index: 1, codes: [code] }]);
    expect(output.currency_totals).toEqual([{ currency: "USD", amount: "1.00", row_count: 1 }]);
  });

  it("accepts zero, leading zeros and optional plus without lossy conversion", () => {
    const output = auditCsv(csv(["v,a,+000.10,USD", "v,b,0,USD", "v,c,000.20,USD"]));
    expect(output.currency_totals).toEqual([{ currency: "USD", amount: "0.30", row_count: 3 }]);
  });

  it.each(["JPY", "usd", " USD", "USD ", ""])('rejects unsupported exact currency "%s"', (currency) => {
    expect(auditCsv(csv([`v,i,1,${currency}`])).rejected_rows).toEqual([{ row_index: 1, codes: ["UNSUPPORTED_CURRENCY"] }]);
  });

  it("bounds UTF-8 bytes at64KiB without counting UTF-16 code units", () => {
    const fixed = `${header}\nv,,0,USD`;
    const accepted = `${header}\nv,${"a".repeat(65536 - Buffer.byteLength(fixed))},0,USD`;
    expect(Buffer.byteLength(accepted)).toBe(65536);
    expect(auditCsv(accepted).row_count).toBe(1);
    inputError(accepted + "a", "INPUT_TOO_LARGE");
    inputError(csv([`v,${"🧾".repeat(16384)},0,USD`]), "INPUT_TOO_LARGE");
  });

  it("rejects wrong input types and unpaired surrogates", () => {
    inputError(1 as unknown as string, "INVALID_INPUT");
    inputError(csv(["v,\ud800,1,USD"]), "INVALID_UTF8");
  });
});

describe("audit output consistency checker", () => {
  it.each(names)("accepts matching input and manual golden: %s", (name) => {
    expect(checkAuditOutput(fixture(name, "csv"), golden(name), golden(name))).toEqual({ ok: true });
  });

  it("accepts a fresh computed result for input outside the fixture suite", () => {
    const input = csv(["fresh,custom,+11.25,EUR", "fresh,custom,0.75,EUR"]);
    expect(checkAuditOutput(input, auditCsv(input))).toEqual({ ok: true });
  });

  it("rejects a receipt/report bound to different raw input", () => {
    expect(checkAuditOutput(fixture("mixed-validity", "csv") + "\n", golden("mixed-validity"))).toEqual({ ok: false, code: "INPUT_HASH_MISMATCH" });
  });

  it.each([
    ["schema version", (report: AuditReport) => { report.schema_version = 2 as 1; }],
    ["row count", (report: AuditReport) => { report.row_count--; }],
    ["accepted count", (report: AuditReport) => { report.accepted_row_count++; }],
    ["rejected count", (report: AuditReport) => { report.rejected_row_count--; }],
    ["duplicate row", (report: AuditReport) => { report.duplicate_groups[0]!.row_indices = [1, 3]; }],
    ["duplicate identity", (report: AuditReport) => { report.duplicate_groups[0]!.vendor_id = "other"; }],
    ["rejection reason", (report: AuditReport) => { report.rejected_rows[0]!.codes = ["INVALID_AMOUNT"]; }],
    ["omitted rejection", (report: AuditReport) => { report.rejected_rows.pop(); }],
    ["total amount", (report: AuditReport) => { report.currency_totals[0]!.amount = "0.00"; }],
    ["currency count", (report: AuditReport) => { report.currency_totals[0]!.row_count++; }],
    ["omitted currency", (report: AuditReport) => { report.currency_totals.pop(); }],
    ["payable claim", (report: AuditReport) => { report.totals_are_payable = true as false; }],
    ["extra field", (report: AuditReport) => { Object.assign(report, { approved: true }); }],
  ])("rejects tampered %s", (_name, mutate) => {
    const report = golden("mixed-validity");
    mutate(report);
    expect(checkAuditOutput(fixture("mixed-validity", "csv"), report)).toEqual({ ok: false, code: "REPORT_MISMATCH" });
  });

  it("compares against a separately supplied golden as well as computed consistency", () => {
    const incorrectGolden = golden("mixed-validity");
    incorrectGolden.currency_totals[0]!.amount = "123.00";
    expect(checkAuditOutput(fixture("mixed-validity", "csv"), golden("mixed-validity"), incorrectGolden)).toEqual({ ok: false, code: "GOLDEN_MISMATCH" });
  });

  it("rejects malformed output and unusable input", () => {
    expect(checkAuditOutput(fixture("mixed-validity", "csv"), null)).toEqual({ ok: false, code: "REPORT_MISMATCH" });
    expect(checkAuditOutput("", golden("mixed-validity"))).toEqual({ ok: false, code: "INPUT_INVALID" });
  });
});
