# AgentTrust NEAR demo narration

Working script for a short X video. Final cue times follow the generated voice. `r4` is a saved 12 November testnet run; the direct-call refusal and retry are separate attempts.

## 1 · Outcome first

An agent needs a paid invoice audit. The first supplier lacks the required capability credential. The buyer's read-only preview blocks that payment; allowed B can still deliver a checked report.

## 2 · Owner and NEAR boundary

The owner funds a native NEAR contract and pins exact trusted suppliers, the audit capability, accepted issuer, and spending caps. A restricted worker key may call only the contract's payment method.

## 3 · Recorded A preview

In this saved local-model run, the host offers A. The model requests `pay_service`; the host binds the fixed CSV and payment ID. The preview returns `MISSING`, with no transaction.

## 4 · Recorded B purchase

The host then offers B as the configured fallback. The model requests B. The contract checks the owner's rules and schedules payment. Final receipts show a zero point zero zero two NEAR transfer to B. The callback later marks the payment settled.

## 5 · Useful checked result

After verifying settlement, B releases the audit. Row nine is rejected for a negative amount. Invoice A-100 is flagged as a duplicate. Eight of fifteen rows pass. A separate checker confirms the report against the synthetic input.

## 6 · Separate direct bypass test

Preview is convenient, but the rule is mandatory. In separate direct r4-16, the worker skips preview and tries A. The contract returns `MISSING`: no payment and no provider payout. Network gas still applies.

## 7 · Separate exact retry test

Separate direct r4-17 paid B. Its exact r4-18 retry keeps the same payment ID, quote, and credential. The contract returns `duplicate: true`. The original settlement remains, with no second provider transfer.

## 8 · Scope and proof

This is NEAR testnet. The model and MCP ran locally; both providers and the issuer were project-operated. We reused the website and built a new native payment flow. One refund-order case remains open. Dated proof and quickstart are in our docs.
