# Invoice audit fixture suite v1

Public synthetic inputs for the bounded `invoice.audit.v1` capability. The actual
engine is [audit.ts](../../../examples/invoice-audit/src/audit.ts); its API is
`auditCsv(csvUtf8): AuditReport`. It computes from the supplied input and does not
select a canned fixture result.

This is a structural CSV check. It does not verify whether an invoice is genuine,
a vendor exists, goods were delivered, tax is correct, or an amount should be paid.
Currency labels below describe invoice data; they are not supported blockchain
payment assets or exchange-rate conversions. AgentTrust payment remains native NEAR.

## Accepted input

- At most **65,536 UTF-8 bytes**. JavaScript strings with unpaired UTF-16 surrogates
  reject. The input hash is the existing protocol request hash over the exact raw
  UTF-8 bytes, including BOM, whitespace and record terminators.
- Exactly four case-sensitive header names, in any order: `vendor_id`,
  `invoice_id`, `amount`, `currency`. Missing, duplicate or extra columns in the
  header reject the input. Headers are not trimmed. One initial UTF-8 BOM is
  accepted for parsing only.
- Comma separators and LF or CRLF record terminators. A quoted field starts with
  `"`, ends with `"`, and represents an embedded quote as `""`. Quoted fields may
  contain commas and line breaks, which are preserved. Outside quotes, bare CR,
  a quote inside an unquoted field, or any text/space after a closing quote rejects
  the input. Optional final record terminator does not add a row. Further blank
  data records do count and are rejected for their column count.
- IDs use ECMAScript `String.trim()` on their outer whitespace only; they must be
  nonempty afterward. Internal whitespace, quotes, line breaks, Unicode spelling
  and letter case remain significant. No Unicode normalization occurs.
- Amount syntax is signed base10 digits with an optional fractional part of one
  or two digits: `[+-]?[0-9]+(\.[0-9]{1,2})?`. Leading zeros and optional `+` are
  accepted. Every minus-prefixed valid number, including `-0`, is rejected.
  Exponents, grouping separators, currency symbols, whitespace, missing integer
  digits and more than two fractional digits reject. Arithmetic uses integer
  minor units through `BigInt`, never floating point.
- Demo currencies are exactly **EUR, INR, USD**, all treated as two-decimal units.
  Currency strings are not trimmed or case-folded. No cross-currency grand total
  is produced.

`readAuditCsv(csvUtf8)` performs raw-input, syntax and header validation and returns
the input hash, column positions and decoded data records. Later HTTP handlers can
use it before offering a quote. It does not run the audit's row-value checks.
`AuditInputError` has a typed `code`: `INVALID_INPUT`, `INPUT_TOO_LARGE`,
`INVALID_UTF8`, `CSV_SYNTAX` or `INVALID_HEADER`. Syntax errors also carry
`record_index`, where the header is0 and the first data record is1. Syntax/header
failure produces no partial report because record boundaries may be unusable.

## Report rules

`row_count` counts logical data records, not physical lines. `row_index` is
one-based after the header. Each row is accepted or rejected exactly once.
Rejection codes are reported in this order:

1. `COLUMN_COUNT` alone if the data row does not have four fields.
2. `EMPTY_VENDOR_ID`, `EMPTY_INVOICE_ID`.
3. `INVALID_AMOUNT` or `NEGATIVE_AMOUNT`.
4. `UNSUPPORTED_CURRENCY`.

Multiple value errors can be reported for a four-field row. Rejected rows are
excluded from both totals and duplicate grouping. This report does **not** claim
to list all repeated raw IDs in invalid rows.

Duplicate groups use the exact pair `(trimmed vendor_id, trimmed invoice_id)`
among accepted rows, regardless of amount or currency. They appear in first-seen
order with ascending logical row indices. A group is not itself a rejection or
an assertion of fraud. **All accepted duplicate rows are included in totals**.
Per-currency totals appear in EUR/INR/USD order when that currency has accepted
rows, use two fractional digits, and include each currency's accepted row count.
`totals_basis="all_valid_rows_including_duplicates"` and
`totals_are_payable=false` explicitly prevent treating the total as an amount due.
Header-only input is a valid empty report.

## Manually checked goldens

Each `.json` file is a declared expected report, not output captured from the
engine. Totals, groups and rejection indices were calculated before implementation.
Raw input hashes were computed with Python `hashlib` over the protocol domain and
actual CSV bytes. A separate reference pass using Python `csv`, `Decimal` and
`hashlib` matched all four complete reports without calling the project code.
This is fixture cross-checking, not an independent financial or security audit.

| Fixture | Data / accepted / rejected rows | Expected arithmetic |
|---|---|---|
| `mixed-validity` |15 /8 /7 | USD10.10 +2.05 +0.10 +7 =19.25; EUR1.20 +2.03 =3.23; INR9999999999999999.99 +0.01 =10000000000000000.00 |
| `quoted-multiline` |6 /6 /0 | USD1.25 +2.75 +1.01 =5.01; EUR0.10 +0.20 =0.30; INR+00.50 =0.50 |
| `rejected-values` |9 /1 /8 | Only `+0` is accepted; USD0.00. Blank final data record is rejected. |
| `header-only` |0 /0 /0 | No currency totals or duplicate groups |

`mixed-validity` groups `acme/A-100` at rows1–2 after outer trimming; uppercase
`ACME` stays distinct. Its rejected records are negative amount9, precision10,
exponent11, unsupported currency12, empty vendor13, empty invoice14, wrong field
count15. `quoted-multiline` reorders the header, includes a BOM and CRLF, retains
escaped quotes/commas and two embedded CRLF pairs, and has six data records despite
those embedded lines. Duplicate groups are rows1–2 and3–4.

## Output verification

`checkAuditOutput(csvUtf8, candidate, golden?)` is in
[check-output.ts](../../../examples/invoice-audit/src/check-output.ts). It uses the
shared syntax reader, then separately computes row classification, grouping and
exact totals without calling `auditCsv`. It checks the input hash and complete
report shape/content, including unknown fields and the non-payable totals labels.
A supplied golden adds a second exact comparison against the manually checked
fixture. Results are `{ok:true}` or `{ok:false, code}` with `INPUT_INVALID`,
`INPUT_HASH_MISMATCH`, `REPORT_MISMATCH` or `GOLDEN_MISMATCH`.

The checker shares the CSV grammar and hash primitive. It can establish bounded
consistency and catch changed/omitted output; it cannot independently establish
business truth, service ownership, payment settlement or trustworthy arbitrary
provider behavior. Credential issuance and paid-service transport belong to
later tasks.

Run pure checks from the repository root:

```sh
. scripts/env.sh
pnpm exec vitest run examples/invoice-audit/test/audit.test.ts
```
