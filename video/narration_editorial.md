# AgentTrust NEAR editorial demo — spoken narration

**Cut:** 127.6 seconds, local Kokoro `af_heart` narration at 0.94 speed, with Whisper-aligned fixed captions. The locally generated voice has public-use rights under the documented license; no founder face or synthetic face appears. “We” means the AgentTrust project team and refers only to work documented in the [r4 testnet proof](https://docs.agenttrust.tech/verification/testnet-r4).

The opening proves the stakes in four quick beats: a separate executed A refusal, its zero-payout docs row, the saved model B final view, and the fully checked report graphic. The distinct attempt and source labels change with each cut. The dated website and docs stills, site's hero loop, and two real Decisions expansion clips then carry the full story. Three designed slides explain the owner boundary, asynchronous NEAR receipt, and checked synthetic report; the direct retry uses a fourth editorial layout containing a crop of the dated docs table. Camera crops over stills are editorial moves, not simulated website scrolling or navigation. Spoken captions sit in one fixed Loom-style box.

## Spoken copy

### 01 · 00:00–00:21 · Proof hook

An AI agent needs to buy an invoice audit. Supplier A lacks the required credential. A separate testnet call returns MISSING with no provider payout. The saved model requests approved B. Its 0.002 NEAR payment settles. B releases a checked 15-row report.

### 02 · 00:21–00:34 · Product and problem

We built AgentTrust for the moment an AI agent wants to spend. The owner names exact suppliers, required capabilities and limits. The agent receives a narrow payment tool.

### 03 · 00:34–00:47 · Owner boundary

The test owner trusts two exact service identities, requires an invoice.audit.v1 credential from an accepted issuer, and caps each purchase. The worker key can call only execute_payment.

### 04 · 00:47–01:01 · Saved local-model A preview

In our saved local-model run, five tool requests are recorded. The model reads policy and supplier details, then asks to pay A. The host previews MISSING; no transaction is sent.

### 05 · 01:01–01:12 · Saved local-model B request

We then offer approved B. The model requests B; the host binds the original CSV and payment ID. The public Decisions page shows that B payment settled.

### 06 · 01:12–01:22 · Native NEAR receipt

The final NEAR receipt shows 0.002 NEAR transferring from the core to B. A later callback marks the payment settled.

### 07 · 01:22–01:38 · Useful checked result

Only after settlement does B release its report. Of 15 synthetic invoice rows, eight pass and seven fail. It catches a negative amount on row nine and duplicate invoice A-100. A separate checker verifies this fixed report.

### 08 · 01:38–01:51 · Separate direct exact retry

A separate direct B purchase settled. Its exact retry reused the same payment ID, quote and credential. The contract returned duplicate true; no second provider payout.

### 09 · 01:51–02:08 · Scope and destination

That's AgentTrust on NEAR testnet: the owner's rules in the payment path. The model and MCP ran locally; we ran both providers and the issuer. The dated proof, quickstart and open refund-order case are in our docs.

## Evidence and delivery notes

- The hook stitches together **separate recorded results**, not one live continuous run: executed direct **r4-16** A refusal, then the saved model's **B** final view and checked synthetic report. Source labels change at each cut. The dated Decisions clips are read-only final views, not new submissions. The no-payout result comes from the [r4 direct-call table](https://docs.agenttrust.tech/verification/testnet-r4), not from the Decisions row alone. Network gas still applies.
- The model's A result is a **read-only preview** with no transaction. The saved local-model tool trace is self-recorded; it does not by itself prove payment. The model was offered only the currently host-allowed supplier, and the host fixed the original CSV and payment ID.
- The model B purchase uses payment ID **ZIu51…JJaHo=**, final transaction [EAmDN…3eNGfSF](https://testnet.nearblocks.io/txns/EAmDNch3Qi9LLeD2cSxp93oC5NAFD6N8SWzFT3eNGfSF), and transfer receipt **HS3f…QSaX5j**. The Decisions row is a final contract view and does not contain that transaction or checked HTTP report.
- The exact retry is of the **separate direct r4-17 B purchase**, payment ID **vhPJvv…BCniU=**. The [r4-18 transaction](https://testnet.nearblocks.io/txns/4E6XwrwGAN7YepiQZ7HV3VjRQn7Ux7B5WUKcBWfFVYet) returned duplicate true and made no additional provider transfer. Never present it as a retry of the model purchase.
- The audit fixture is synthetic and controlled. The separate checker verified this report against the fixed input; it is not a claim about general audit accuracy.
- The public website and docs are read-only. Only the two existing Decisions clips show a real recorded page expansion; the landing and docs visuals are dated still captures. No visible click starts a purchase. Keep the private repository, raw local journals, keys, and owner credentials out of frame. The refund-order native runtime case remains open.
