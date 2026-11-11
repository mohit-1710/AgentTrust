//! Source-wired admission over ordinary values. Only the contract supplies the
//! actual caller, registered identity, balances and host signature verifier.
use crate::{
    accounting::{
        AggregateLiabilities, PaymentAccounting, PaymentError, PaymentRecord, PaymentState,
        existing_payment, reserve_payment,
    },
    authority::{CallContext, authenticate_worker},
    codec::encode_invoice,
    owner::ActorState,
    policy::{self, BackingSnapshot, CredentialEvidence, Decision, DenialCode, PolicySnapshot},
    registry::{CredentialRef, ServiceIdentity},
    types::{FixedBytes, SignedInvoiceV1, U64String},
};

pub struct AdmissionSnapshot<'a> {
    pub call: &'a CallContext<'a>,
    pub now_ns: u64,
    pub network: &'a str,
    pub owner: Option<&'a ActorState>,
    pub service: Option<&'a ServiceIdentity>,
    pub backing: BackingSnapshot,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PaymentAdmission {
    Rejected(Decision),
    Duplicate(PaymentRecord),
    Reserved(PaymentAccounting),
}

/// Authentication -> immutable replay/conflict -> current ordered evaluation ->
/// financial replacement. No allocation to persistent state or promise occurs.
/// The verifier receives only the current registered key and canonical bytes.
pub fn admit_payment(
    snapshot: &AdmissionSnapshot<'_>,
    quote: &SignedInvoiceV1,
    credential: CredentialEvidence<'_>,
    existing: Option<&PaymentRecord>,
    verify: impl FnOnce(&[u8; 64], &[u8], &[u8; 32]) -> bool,
) -> Result<PaymentAdmission, PaymentError> {
    let unauthorized = || PaymentAdmission::Rejected(Decision::deny(DenialCode::Unauthorized));
    let Some(owner) = snapshot.owner else {
        return Ok(unauthorized());
    };
    let invoice = &quote.invoice;
    let Some(session) = owner.sessions.get(&invoice.session_id) else {
        return Ok(unauthorized());
    };
    if owner.owner_id != invoice.owner_id
        || session.session_id != invoice.session_id
        || authenticate_worker(snapshot.call, &owner.owner_id, session).is_err()
    {
        return Ok(unauthorized());
    }
    match existing_payment(existing, invoice) {
        Ok(Some(record)) => return Ok(PaymentAdmission::Duplicate(record)),
        Ok(None) => {}
        Err(PaymentError::Denied(code)) => {
            return Ok(PaymentAdmission::Rejected(Decision::deny(code)));
        }
        Err(error) => return Err(error),
    }
    let signature_valid = snapshot.service.is_some_and(|service| {
        verify(
            &quote.signature.0,
            &encode_invoice(invoice),
            &service.invoice_key.0,
        )
    });
    let decision = policy::evaluate(
        &PolicySnapshot {
            now_ns: snapshot.now_ns,
            network: snapshot.network,
            core_account: snapshot.call.current_account,
            owner,
            service: snapshot.service,
            signature_valid,
            usage: owner.usage.snapshot(snapshot.now_ns),
            backing: snapshot.backing,
        },
        invoice,
        credential,
    );
    if decision != Decision::Allow {
        return Ok(PaymentAdmission::Rejected(decision));
    }
    match reserve_payment(
        owner,
        AggregateLiabilities {
            available_yocto: snapshot.backing.aggregate_available_yocto,
            storage_credit_yocto: snapshot.backing.aggregate_storage_credit_yocto,
        },
        invoice,
        credential.reference,
        None,
        snapshot.now_ns,
    ) {
        Ok(state) => Ok(PaymentAdmission::Reserved(state)),
        Err(PaymentError::Denied(code)) => Ok(PaymentAdmission::Rejected(Decision::deny(code))),
        Err(error) => Err(error),
    }
}

/// Bound = exact serialized record + 1024 bytes for both identity-map keys,
/// first recent-ID vector header/entry, one 24-byte day bucket and trie-record
/// overhead. Existing actor/root counters and callback replacements are fixed
/// width. Current maximum account IDs are 64 bytes, hashes 32 bytes. The adapter
/// bills measured growth and panics before scheduling if this bound is exceeded;
/// this estimate is not a substitute for T13 host storage proof.
pub fn payment_storage_bound(quote: &SignedInvoiceV1, credential: Option<&CredentialRef>) -> u64 {
    let record = PaymentRecord {
        invoice: quote.invoice.clone(),
        invoice_hash: FixedBytes([0; 32]),
        credential: credential.cloned(),
        dispatched_at_ns: U64String(0),
        dispatch_day: U64String(0),
        dispatch_minute: U64String(0),
        state: PaymentState::Pending,
        finalized_at_ns: U64String(0),
    };
    (borsh::to_vec(&record)
        .expect("bounded payment encoding")
        .len() as u64)
        .saturating_add(1024)
}

/// Actual post-storage state, before this transfer is scheduled. A was already
/// debited by amount, so amount must be included again in this pre-transfer guard.
pub fn required_before_transfer(
    storage_stake_yocto: u128,
    operating_reserve_yocto: u128,
    liabilities_after_reservation: AggregateLiabilities,
    amount_yocto: u128,
) -> Option<u128> {
    storage_stake_yocto
        .checked_add(operating_reserve_yocto)?
        .checked_add(liabilities_after_reservation.storage_credit_yocto)?
        .checked_add(liabilities_after_reservation.available_yocto)?
        .checked_add(amount_yocto)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentDisplayState {
    Pending,
    Settled,
    Failed,
    NeedsReconciliation,
}
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct PaymentView {
    #[serde(flatten)]
    pub record: PaymentRecord,
    pub display_state: PaymentDisplayState,
}
impl PaymentView {
    pub fn new(record: PaymentRecord, now_ns: u64) -> Self {
        let display_state = match record.state {
            PaymentState::Pending
                if now_ns.saturating_sub(record.dispatched_at_ns.0) >= 120_000_000_000 =>
            {
                PaymentDisplayState::NeedsReconciliation
            }
            PaymentState::Pending => PaymentDisplayState::Pending,
            PaymentState::Settled => PaymentDisplayState::Settled,
            PaymentState::Failed => PaymentDisplayState::Failed,
        };
        Self {
            record,
            display_state,
        }
    }
}
