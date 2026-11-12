//! Read-only pagination and current-policy preview, with no caller authority.
use crate::{
    codec::encode_invoice,
    owner::ActorState,
    policy::{self, BackingSnapshot, CredentialEvidence, Decision, DenialCode, PolicySnapshot},
    registry::ServiceIdentity,
    types::{AccountId, SignedInvoiceV1, U64String},
};
use serde::Serialize;
#[derive(Debug, PartialEq, Eq)]
pub struct IndexPage {
    pub start: u32,
    pub end: u32,
    pub next_cursor: Option<U64String>,
}
pub fn page_indices(
    total: u32,
    cursor: Option<U64String>,
    limit: u32,
    newest_first: bool,
) -> Result<IndexPage, &'static str> {
    if !(1..=20).contains(&limit) {
        return Err("INVALID_PAGE_LIMIT");
    }
    let at = cursor.map_or(if newest_first { total as u64 } else { 0 }, |v| v.0);
    if at > total as u64 {
        return Err("INVALID_CURSOR");
    }
    let at = at as u32;
    let (start, end, next) = if newest_first {
        let start = at.saturating_sub(limit);
        (
            start,
            at,
            if start > 0 {
                Some(U64String(start as u64))
            } else {
                None
            },
        )
    } else {
        let end = at.saturating_add(limit).min(total);
        (
            at,
            end,
            if end < total {
                Some(U64String(end as u64))
            } else {
                None
            },
        )
    };
    Ok(IndexPage {
        start,
        end,
        next_cursor: next,
    })
}
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct PreviewResult {
    pub authorization: &'static str,
    pub decision: Decision,
}
pub struct PreviewSnapshot<'a> {
    pub now_ns: u64,
    pub network: &'a str,
    pub core_account: &'a AccountId,
    pub owner: Option<&'a ActorState>,
    pub service: Option<&'a ServiceIdentity>,
    pub backing: BackingSnapshot,
}
pub fn preview_payment(
    snapshot: &PreviewSnapshot<'_>,
    quote: &SignedInvoiceV1,
    credential: CredentialEvidence<'_>,
    verify: impl FnOnce(&[u8; 64], &[u8], &[u8; 32]) -> bool,
) -> PreviewResult {
    let decision = if let Some(owner) = snapshot.owner {
        let signature_valid = snapshot.service.is_some_and(|service| {
            verify(
                &quote.signature.0,
                &encode_invoice(&quote.invoice),
                &service.invoice_key.0,
            )
        });
        policy::evaluate(
            &PolicySnapshot {
                now_ns: snapshot.now_ns,
                network: snapshot.network,
                core_account: snapshot.core_account,
                owner,
                service: snapshot.service,
                signature_valid,
                usage: owner.usage.snapshot(snapshot.now_ns),
                backing: snapshot.backing,
            },
            &quote.invoice,
            credential,
        )
    } else {
        Decision::deny(DenialCode::Unauthorized)
    };
    PreviewResult {
        authorization: "not_proven_by_view",
        decision,
    }
}
