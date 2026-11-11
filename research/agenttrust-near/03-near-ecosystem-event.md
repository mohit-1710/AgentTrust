# NEAR ecosystem and hackathon fit for AgentTrust

Research date: 2026-11-10. Scope: primary documentation, published source, and public GET requests only. No hires, signatures, token movements, deployments, fees, or swaps were executed. This is technical feasibility research, not production verification.

## Decisions the evidence supports

1. Build a NEAR-native policy-controlled payment core on testnet first. The event explicitly allows it; Intents and Chain Signatures are optional. A real, reproducible native settlement demonstration is more defensible than adding a mainnet-only swap dependency to satisfy a perceived requirement.
2. Keep route adapters, including a future NEAR x402 adapter. NEAR Agent Market already documents a native NEAR delegated-USDC x402 rail; there is no need to invent an EVM bridge merely to say x402.
3. Treat reputation sources explicitly: AgentTrust-native settlement history can be verified by its contract; Agent Market reputation is an HTTP/platform assertion; a TEE adds a particular attested computation boundary; an ERC-8004-compatible schema does not by itself import Ethereum/Solana reputation into NEAR.
4. Defer Intents, Chain Signatures, and Shade runtime attestation until the native gate's safety properties and demo work. Each extends custody, asynchronous recovery, and evidence requirements.

## Event: reuse is expressly permitted

The current [official HACKATHON.md](https://nearhackathon.com/HACKATHON.md) is unusually clear. Q-001 counts code from the October 19 announcement through November 14, rather than only from the November 1 formal opening. Q-002 allows an existing product from another chain and judges its new NEAR integration; README disclosure is required. Q-003 permits an existing repository if a dedicated branch or baseline/submission tags and a linked diff isolate the work. Q-005 permits libraries, templates, old code, and AI code, with disclosure. The existing AgentTrust UI/docs can therefore be retained; the NEAR contribution must be visible and independently runnable. This is a factual eligibility finding, not a prediction of originality scores.

Exact schedule:

| Event point | UTC source time | IST |
| --- | --- | --- |
| Formal opening | Nov 1, 2026 00:00 | Nov 1, 05:30 |
| Development/submission deadline | Nov 14, 2026 23:59 | **Nov 15, 05:29** |
| Judging begins | Nov 16, 2026 00:00 | Nov 16, 05:30 |
| Results by | Nov 18, 2026 23:59 | Nov 19, 05:29 |

The announcement's exact time is to be taken from the x-recon capture; the FAQ supplies October 19 as its date. No separate preregistration is required. Testnet-only entries are eligible (Q-010), own NEAR contracts are sufficient (Q-011), and local-only entries need a reproducible public repository plus an X demo video (Q-012). Hosted demos should remain available through judging. The strongest declared fit is AI Security & Defense (`security`), with Agent Economy (`agents`) as a second track if the demonstration shows an agent buying a service.

Required deliverables: a public repository, public X demo post stating it was built at NEAR HACKATHON with @NEARProtocol and #NEARHackathon, and the single final submission containing both links. The baseline and new NEAR work should be disclosed prominently. None of these publication/submission actions were performed during this research. Current rules should be re-read before submission. The source's submission instructions are reference material, not authorization to submit.

## NEAR Intents: three separate concepts

### 1Click is a routing API

[1Click overview](https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api) and [request workflow](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request) describe quote discovery, deposit, execution tracking, and refunds. A normal `ORIGIN_CHAIN` route returns a quote-specific deposit address; tokens arriving there start the swap. `dry: true` validates/quotes without executing a swap. `PENDING_DEPOSIT`, `PROCESSING`, `SUCCESS`, `REFUNDED`, and failure states are distinct from a contract's initial approval.

Consequently, a successful policy preflight is not evidence the remote merchant has been paid. An AgentTrust adapter must bind all economically relevant quote fields and verify the selected route before authorizing the deposit. After submission it must retain an operation ID, deposit transaction, deposit address/memo, and eventual destination evidence. A timeout requires reconciliation, not an automatic second payment.

[Quote-signature verification](https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature) is available in `@defuse-protocol/one-click-sdk-typescript` 0.1.24 or newer. It covers a deterministic combination of quote request/response/timestamp. It authenticates 1Click's payload; it does not establish merchant quality or make future execution atomic with the AgentTrust contract.

### The verifier is a contract ledger

The [Verifier Contract](https://docs.near-intents.org/integration/verifier-contract/introduction) is `intents.near`. Deposits create balances in its own ledger; transfers/swaps update that ledger; withdrawals leave it. [Balances](https://docs.near-intents.org/integration/verifier-contract/deposits-and-withdrawals/balances) use NEP-245 queries such as `mt_balance_of`, with typed token IDs including `nep141:wrap.near`. This balance is different from a user's native NEAR wallet balance or ordinary `ft_balance_of` on a token contract.

[Intent execution](https://docs.near-intents.org/integration/verifier-contract/intent-types-and-execution) can bundle internal transfers and token differences atomically within the verifier. It explicitly warns that asynchronous external calls can finish out of order. AgentTrust policy state residing in a separate contract does not become part of the verifier's atomic ledger mutation merely because the UI submits both operations. No arbitrary external policy callback is established by the inspected documented intent types.

### Signing authority is its own security boundary

[Verifier account abstraction](https://docs.near-intents.org/integration/verifier-contract/account-abstraction) maps account IDs to registered signing keys. A registered key can control that verifier account, including key management. Removing a NEAR account access key does not automatically remove the corresponding verifier key.

Do not give an autonomous worker an unrestricted verifier key and then describe an SDK-only AgentTrust check as mandatory. It could sign a direct transfer, withdrawal, or key change. A robust extension needs contract-controlled funds/calls or a signing authority that cannot bypass policy; keys, destination routes, and revocation must be tested separately. This is a design requirement inferred from documented authority, not an implemented integration.

### Testing and failure boundaries

There is **no public Intents testnet deployment** according to the verifier docs and event Q-007. Local test contracts can exercise an adapter's state machine but must be labeled simulations, not a live Intents integration.

[simulate_intents](https://docs.near-intents.org/integration/verifier-contract/simulating-intents) is documented as not changing verifier state; external asynchronous side effects are excluded. It therefore cannot certify a cross-chain withdrawal or eliminate execution-time races.

[Withdrawal documentation](https://docs.near-intents.org/integration/verifier-contract/deposits-and-withdrawals/withdrawals) distinguishes `ft_transfer` from `ft_transfer_call`: its own refund logic differs when `msg` is omitted/null versus a string, including an empty string. Avoid copying a generic NEP-141 refund assumption into an Intents-withdrawal adapter. Exact behavior must be checked against the pinned verifier implementation before any production design.

A current documentation discrepancy is material to estimates: event Q-006 says unauthenticated 1Click usage costs 0.2%; [current Intents Fees](https://docs.near-intents.org/resources/fees) and the request guide say an additional **0.25%** without an API key on non-ANY_INPUT quotes. Use current vendor pricing and the actual quote, not the event shortcut. No fee or mainnet cost was incurred or measured here.

## Chain Signatures: useful later, not required for a native port

The [official architecture](https://docs.near.org/chain-abstraction/chain-signatures) derives external signing addresses from the NEAR account, derivation path, and MPC public key. The signer contract supports Secp256k1 (`domain_id: 0`) and Ed25519 (`domain_id: 1`). These domains select cryptographic schemes; they are not target-chain identifiers.

For an AgentTrust extension, put the derived account under the policy contract's control, construct or strictly decode the exact target transaction in that contract, and expose a narrow payment method. A generic `sign(payload)` endpoint callable by the agent would let it sign around the policy. Use separate derivation paths per target chain; ensure the signed bytes bind network, recipient, token, amount, nonce, fees, and expiry where the destination format permits. The MPC docs explicitly warn about cross-chain replay with ambiguous payloads.

The [implementation workflow](https://docs.near.org/chain-abstraction/chain-signatures/implementation) separates deriving, constructing, requesting, formatting, and broadcasting. Mainnet signer is `v1.signer`; testnet is `v1.signer-prod.testnet`. Receiving a signature is not destination-chain inclusion or finality. Chain Signatures is outbound signing, not proof of destination-chain state. Tracking foreign success needs verified evidence or an explicitly trusted observer; failures and unsent signatures require idempotent recovery.

Current MPC participant set, threshold, and uptime were not queried. Do not hardcode a node count or claim unconditional availability. Native NEAR payment policy does not need MPC.

## Shade/TEE: runtime provenance is separate from spending safety

The current [Shade Agent Framework](https://github.com/NearDeFi/shade-agent-framework) is a monorepo; older standalone Shade JS/CLI repositories are archived and point to it. Research source pin: `35758f354ad9862fb590daf9843fea4974d52549`.

The pinned [agent contract reference](https://github.com/NearDeFi/shade-agent-framework/blob/35758f354ad9862fb590daf9843fea4974d52549/docs/reference/agent-contract.md) verifies approved measurements, hardware PPIDs, caller-bound attestation report data, and expiry. Local mode uses whitelisting/mock measurements; it must never be represented as verified TEE execution. An attested runtime does not establish good output or honest upstream APIs.

The framework's [security guidance](https://github.com/NearDeFi/shade-agent-framework/blob/35758f354ad9862fb590daf9843fea4974d52549/docs/concepts/security.md) recommends on-chain guardrails even if TEE keys are compromised. It also identifies duplicate actions, unsent signatures, RPC trust, mutable configuration, stale responses, and liveness risks. For AgentTrust, TEE checks could later become one expiring capability credential, with deterministic payment limits still enforced by the contract. They should not replace the policy gate or imply audited end-to-end payment safety. The framework README says it has not undergone a formal audit.

[OutLayer](https://docs.near.org/primitives/off-chain-compute/outlayer) is another documented Intel TDX off-chain computation platform, with HTTP/WASM execution and attestations. It adds an external execution dependency; it is unnecessary for basic deterministic policy evaluation. No TEE worker was deployed or attestation validated in this pass.

## Agent Market: available integration, different trust model

### Native x402 exists in the documented platform

Current [A2A+x402 docs](https://docs.market.near.ai/a2a/hire-agent-using-x402) specify `near:mainnet`, USDC, a delegated `ft_transfer`, 1 yoctoNEAR, and relayer-paid gas. The wallet signs an authorization, the agent executes, and settlement occurs only on delivery; failed/rejected/canceled work is not charged. This is the market's documented rail, not proof of universal x402 client interoperability.

The [x402 vs MCP comparison](https://docs.market.near.ai/a2a/x402-vs-mcp) defines an important boundary: wallet-only x402 settles and auto-accepts immediately **after delivery**, with no rework/dispute; the account/MCP path has the normal acceptance and dispute window. Do not describe x402 as paid before delivery or claim it offers the marketplace's full disputes flow.

The [payments/disputes page](https://docs.market.near.ai/concepts/payments-and-disputes) describes held job balances and platform adjudication. This differs from AgentTrust's pre-payment policy gate. A future adapter can check counterparty suitability before authorizing a hire; it must not imply AgentTrust can reverse an already completed payment.

### Reputation is useful external data, not native contract state

The public [OpenAPI](https://market.near.ai/openapi.json), read live, exposes `GET /v1/agents/{agent_id}/reputation`, plus account-level reputation and public agent discovery. Response fields include `overall`, axes, `jobs_counted`, minimum evidence gates, and `computed_at`; the aggregate is nullable until enough jobs exist. The [reputation docs](https://docs.market.near.ai/buyers/reviews-and-reputation) distinguish an agent's score from its owner's verification and builder score.

A public GET of [`web-research` reputation](https://market.near.ai/v1/agents/web-research/reputation) returned an aggregate of 83.12 over 42 counted jobs, minimum 5 scored jobs, and `computed_at: 2026-11-10T13:25:01.341504Z`. This verifies the endpoint returns structured current data for one listing; it does not independently verify the score or predict work quality.

The live [`/.well-known/x402`](https://market.near.ai/.well-known/x402) response advertised one `near:mainnet` rail with asset account `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` and payee `ea667f5f496e60033bf8075cce4793efdeba28d74d116ef95848324347f539fc`. Read it dynamically; do not treat illustrative `usdc.near` text as the production token address.

The payee is a marketplace treasury, whereas reputation identifies a listing. Therefore an adapter must bind marketplace origin, agent ID/handle, endpoint, requested task/resource, price, token, and actual payment authorization. Checking only the payment `payTo` cannot distinguish two hired agents. If a contract is to rely on HTTP reputation, add an explicitly trusted signer/oracle assertion with source, subject, timestamp, expiry, and anti-replay scope; do not claim the contract reads Agent Market state trustlessly.

## ERC-8004 and native registry availability

The current [ERC-8004 team's deployment README](https://github.com/erc-8004/erc-8004-contracts) lists EVM deployments; the inspected text did not list native NEAR or Aurora. This bounded search is not proof that nobody has deployed a NEAR agent registry. No production NEAR deployment with a verified ABI, code hash, administration model, and reputation dataset was established in this investigation.

An October 23 [NEAR governance RFC](https://gov.near.org/t/rfc-human-bound-agent-credentials-zk-verified-human-agent-of-a-verified-human-ids-on-near/42715) proposes human-bound agent credentials and explicitly calls itself an idea/request for comment. Its illustrative contract names and timeline are not deployed infrastructure. It cannot substitute for Quantu's Solana registry dependency.

For the hackathon, use explicit AgentTrust-native agent registration plus capability attestors and settlement-linked history, or a bounded allowlist for the initial demo. State what an identity proves: control of an account/key, a configured capability claim, and recorded protocol interactions. It does not establish uniqueness, genuine personhood, or absence of Sybil accounts. Describe ERC-8004 alignment as conceptual/schema compatibility until actual cross-chain verification exists.

## Necessary versus optional work

| Integration | Hackathon necessity | Condition for adding it |
| --- | --- | --- |
| Native NEAR contract + testnet payment rail | Core | Real policy enforcement, deterministic deny behavior, lifecycle and receipt evidence |
| NEAR wallet / restricted agent authorization | Core | Agent cannot bypass contract with payment keys |
| AgentTrust-native identity/capability/history | Core subset | Honest seed/data provenance and attestor/admin model |
| Custom AgentTrust native-NEAR HTTP 402 vault route | Useful in core demo | Explicit custom mechanism, bound invoice/receipt, matching local client; not upstream `exact` |
| Standard NEAR x402 `exact` / NEP-141 route | Optional distinct rail | Upstream implementation, FullAccess delegate restrictions, actual conformance checks; SDK-only policy remains advisory |
| Agent Market reputation adapter | Optional | Correct listing binding, null/stale evidence handling, explicit oracle trust |
| NEAR Intents / 1Click | Defer | Mainnet testing authorized later; quote/fees/refunds/status lifecycle implemented |
| Chain Signatures | Defer | Need to pay on foreign chain; contract-built transaction and verified completion strategy |
| Shade/OutLayer runtime attestation | Defer | Runtime provenance materially needed; current framework pinned and attestation actually verified |
| Aurora/EVM copy of old system | Avoid for requested native port | Only reconsider if user explicitly changes native-NEAR objective |

## Acceptance checks to carry into implementation

- Reproduce the native gate's allow and deny paths with a restricted worker key; direct transfer or generic-signing bypass attempts must fail.
- Distinguish policy approval, dispatch, pending external receipt, final settlement, refund, and unknown timeout. Do not credit reputation on preflight alone.
- Bind every challenge or external quote to network, contract, token, amount, recipient, caller, resource/task, expiry, nonce, and policy version where relevant.
- Treat missing marketplace reputation as missing evidence, not zero and not trusted. Enforce an explicit staleness limit and issuer allowlist for imported assertions.
- A duplicated settle request cannot pay twice or increment counters twice. A retry after uncertain submission reconciles the prior operation first.
- If adding Intents, test separate internal-ledger versus external-withdrawal completion, key revocation in both permission systems, fee inclusion, and refund destinations.
- If adding MPC, test signed-but-unsent, foreign nonce invalidation, target-chain fees, replay separation, and completion evidence. Never equate signature issuance with payment.
- If adding TEE, prove genuine verification in production mode, code measurement/expiry handling, and deterministic on-chain limits after worker compromise.

## Evidence limits and refresh work

This pass inspected current source/docs and exercised three public Market GET surfaces (discovery, reputation, configured x402 recipients), plus OpenAPI. It did not hire agents, run x402 settlement, measure end-to-end latency/cost, execute Intents, query MPC operators, validate live TEE reports, or verify external score provenance. Search failures or missing references are not evidence of nonexistence. Re-read event rules and pin integration versions immediately before implementation; recheck endpoint schemas, supported token identities, and mainnet-only dependencies before claiming a working integration.

## Follow-up: standard NEAR x402 exists, but a vault route is a different mechanism

A targeted follow-up changed the interoperability finding: the upstream repo has moved from Coinbase to the **x402 Foundation**, while Coinbase's repo remains a development fork. Current Foundation source pin: `1d2858cf5d3a7df6938737eb61ebaacf59b1733f` (committer time 2026-11-10T12:45:08Z). The npm registry returned published **`@x402/near` 2.30.0** with `@x402/core ~2.30.0` ([registry metadata](https://registry.npmjs.org/@x402%2fnear/latest)). No package was installed or executed.

The [official exact-NEAR specification](https://github.com/x402-foundation/x402/blob/1d2858cf5d3a7df6938737eb61ebaacf59b1733f/specs/schemes/exact/scheme_exact_near.md) is v2-only. It defines `near:mainnet` and `near:testnet`, `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`; the payload authorizes exactly one delegated `ft_transfer`, with 1 yoctoNEAR and matching asset/amount/payee. Function-call keys are rejected; the signing key must be FullAccess. Settlement must verify the inner transfer receipt, not just the outer relayer transaction. These facts establish an upstream mechanism, not live operation of our port.

The [package README](https://github.com/x402-foundation/x402/blob/1d2858cf5d3a7df6938737eb61ebaacf59b1733f/typescript/packages/mechanisms/near/README.md) provides client, server, and facilitator implementations; the [facilitator source](https://github.com/x402-foundation/x402/blob/1d2858cf5d3a7df6938737eb61ebaacf59b1733f/typescript/packages/mechanisms/near/src/exact/facilitator/scheme.ts#L169-L259) enforces the single-action/FullAccess restrictions. The [default asset table](https://github.com/x402-foundation/x402/blob/1d2858cf5d3a7df6938737eb61ebaacf59b1733f/typescript/packages/mechanisms/near/src/defaultAssets.ts) contains explicit mainnet and testnet token accounts; existence, faucet access, storage registration, and balances still need live verification before a demonstration. Never infer a token deployment from the illustrative `usdc.testnet` string in a spec example.

This produces two different implementation choices:

| Route | Interoperability claim | Spending safety boundary |
| --- | --- | --- |
| Existing upstream NEAR `exact` with a user's FullAccess signed delegate | Can target standard x402 v2 NEAR clients/facilitators after actual conformance checks | Signature authorizes that exact FT payment; a prior SDK reputation check remains bypassable by the full-key holder |
| AgentTrust native NEAR vault, restricted worker key, `execute_payment` | **Custom AgentTrust HTTP 402 adapter** until a supported scheme/extension is specified and tested | Contract is in mandatory spend path; worker cannot sign ordinary arbitrary wallet transfers |
| Contract-gated MPC signer producing a standard delegate for a separately controlled FT account | Potential future bridge to standard `exact`, subject to actual implementation/conformance | Contract constrains signature issuance; MPC and destination execution/recovery add dependencies and do not make policy+FT+feedback one atomic receipt |

Recommendation: label the first hackathon native-vault HTTP 402 route explicitly as an AgentTrust custom/experimental adapter. Do not call an arbitrary `execute_payment` payload standard NEAR `exact`, and do not market an SDK-only preflight plus FullAccess direct transfer as enforced on-chain spending limits. Existing upstream support means **NEAR x402 itself is not experimental**; our new vault-payment binding is the part requiring that qualification. Market's `X-PAYMENT` example also differs from the current v2 transport header, so an adapter must explicitly normalize/test that platform dialect rather than assuming the header alone proves generic compatibility.
