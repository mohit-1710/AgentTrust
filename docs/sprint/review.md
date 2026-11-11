# Planning review and dispositions

11 November 2026. Static model review of the architecture, task plan, baseline inventory, verification matrix, workflow and README. A fresh reviewer plus a bounded scope/schedule review challenged the coordinator's draft. This is a consistency/security-design review, not an independent human audit or runtime verification. No implementation/test results are implied.

## Material findings and incorporated changes

| Finding | Disposition | Owning verification |
|---|---|---|
| An endpoint hash cannot tell `payService(serviceId)` which URL to call | Add explicit bounded SDK catalog keyed by service/version, verify configured origin commitment against registry; no arbitrary URL/discovery; retain versions for completed-result retrieval | T14; V31 |
| Stable ID alone does not preserve the original quote after crash/uncertain broadcast | Save exact signed attempt before send in private ordinary local files; save failure prevents send; not-found during uncertainty cannot trigger replacement invoice/ID | T17; V26 |
| Existing payment could be returned for a changed CSV/service, or expiry could make paid output unavailable | Compare immutable requested context and input hash before resume; settled receipt redeems original bytes after quote expiry; retrieval failure never triggers repayment | T17; V20,V25 |
| Runtime T13 needed observable state but views appeared only in T14 | Move minimal config/policy/session/account/payment views into core T05/T06/T10; T14 owns SDK/finality and remaining reads/paging | T05,T06,T10,T13 |
| Website marketing/media claims were not owned by a task | Add explicit T22 copy/media/metadata inventory and rendered claim inspection | T22; V34 |
| Cut list removed mostly unallocated work; runtime prep was confused with execution time | Thirty tasks total21h10; review2h50; runtime/hosting handoff3h; contingency6h45 =33h45 initial workload. Actual cuts save at most90min; missing gates stay incomplete. User handoff windows proposed, availability unverified | Plan clock/cuts; workflow |
| Baseline inventory and plan claimed different scope authority | Plan selects first build; research supplies rationale; optional approval/FT remain excluded | Baseline/README/research pointers |

Coordinator also fixed two concrete integration gaps: fixture-only conformance endpoint removes circular need for an existing payment credential before validation; evidence distinguishes preview, executed rejection and recorded replay so an advisory refusal cannot masquerade as an on-chain denial. These are in T16/T23 and V27/V33.

The bounded reviewer recheck confirmed all four main and three scope fixes were represented. Its final two clarifications are incorporated: new purchases validate current registry identity, while settled-result retrieval binds the retained catalog to its original immutable invoice; stable payment IDs persist within an attempt, and a supplier change after definitive no-dispatch evidence is a separately identified attempt. No residual design contradiction was identified in those reviewed fixes. This does not close the empirical gates below.

## Remaining empirical questions

- Actual NEAR restricted-key/signer/predecessor behavior and management deposit boundary.
- Host balance deduction, lazy Promise scheduling, serialized storage stake and refund/callback ordering.
- Rust/TypeScript exact byte/signature agreement and pinned dependency compatibility.
- Actual final receipt plus request-bound paid response, replay behavior and user-visible failure states.

These have explicit tests/tasks; they cannot be resolved by further prose review. Their runtime portion remains user-run under the standing database-write restriction. The user-facing outcome depends on real evidence from those gates.

The scope is frozen around one native rail and a complete useful task. Reopening is limited to evidence described in the workflow. No prize probability or certification follows from this review.
