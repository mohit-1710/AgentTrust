//! Checked actor claims over ordinary values; host storage measurement lives in the contract.
use crate::{
    authority::AuthorityError,
    codec::invoice_hash,
    owner::ActorState,
    policy::{DAY_NS, DenialCode, MAX_OUTSTANDING_TRANSFERS, MAX_RETAINED_PAYMENTS, MINUTE_NS},
    registry::CredentialRef,
    types::{FixedBytes, Hash32, InvoiceV1, U64String, U128String},
};
use borsh::{BorshDeserialize, BorshSerialize};
use serde::Serialize;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct AggregateLiabilities {
    pub available_yocto: u128,
    pub storage_credit_yocto: u128,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActorAccounting {
    pub actor: ActorState,
    pub liabilities: AggregateLiabilities,
}

/// Compute a replacement state. The caller must price storage before committing it.
/// This function never changes policy, pending transfers or the operating reserve.
pub fn credit_deposit(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    attached_yocto: u128,
    storage_allocation_yocto: u128,
) -> Result<ActorAccounting, AuthorityError> {
    if attached_yocto == 0 || storage_allocation_yocto > attached_yocto {
        return Err(AuthorityError::InvalidDeposit);
    }
    let principal = attached_yocto - storage_allocation_yocto;
    let available = actor
        .ledger
        .available_yocto
        .0
        .checked_add(principal)
        .ok_or(AuthorityError::ArithmeticOverflow)?;
    let storage_credit = actor
        .ledger
        .storage_credit_yocto
        .0
        .checked_add(storage_allocation_yocto)
        .ok_or(AuthorityError::ArithmeticOverflow)?;
    let total_available = liabilities
        .available_yocto
        .checked_add(principal)
        .ok_or(AuthorityError::ArithmeticOverflow)?;
    let total_storage_credit = liabilities
        .storage_credit_yocto
        .checked_add(storage_allocation_yocto)
        .ok_or(AuthorityError::ArithmeticOverflow)?;
    let mut updated = actor.clone();
    updated.ledger.available_yocto = U128String(available);
    updated.ledger.storage_credit_yocto = U128String(storage_credit);
    Ok(ActorAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: total_available,
            storage_credit_yocto: total_storage_credit,
        },
    })
}

/// Charge only the responsible actor's unused credit; never its principal or a
/// different tenant's credit. Errors leave both input values untouched.
pub fn charge_actor_storage(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    growth_bytes: u64,
    cost_per_byte: u128,
) -> Result<ActorAccounting, AuthorityError> {
    let mut updated = actor.clone();
    let charge = updated.charge_storage_growth(growth_bytes, cost_per_byte)?;
    let total_storage_credit = liabilities
        .storage_credit_yocto
        .checked_sub(charge)
        .ok_or(AuthorityError::StorageCredit)?;
    Ok(ActorAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: liabilities.available_yocto,
            storage_credit_yocto: total_storage_credit,
        },
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentState {
    Pending,
    Settled,
    Failed,
}

/// Immutable admission evidence with a fixed-width terminal state/timestamp.
/// Callbacks must use the stored record, never caller-supplied amounts or days.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct PaymentRecord {
    pub invoice: InvoiceV1,
    pub invoice_hash: Hash32,
    pub credential: Option<CredentialRef>,
    pub dispatched_at_ns: U64String,
    pub dispatch_day: U64String,
    pub dispatch_minute: U64String,
    pub state: PaymentState,
    pub finalized_at_ns: U64String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransferOutcome {
    Succeeded,
    Failed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaymentError {
    Denied(DenialCode),
    InconsistentState,
    ArithmeticOverflow,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PaymentAccounting {
    pub actor: ActorState,
    pub liabilities: AggregateLiabilities,
    pub payment: PaymentRecord,
    pub duplicate: bool,
}

/// Call only after authenticating the worker, before current policy evaluation.
/// A replay preserves the original credential reference and terminal outcome.
pub fn existing_payment(
    existing: Option<&PaymentRecord>,
    invoice: &InvoiceV1,
) -> Result<Option<PaymentRecord>, PaymentError> {
    let Some(record) = existing else {
        return Ok(None);
    };
    if record.invoice.owner_id != invoice.owner_id
        || record.invoice.payment_id != invoice.payment_id
        || record.invoice_hash.0 != invoice_hash(invoice)
    {
        return Err(PaymentError::Denied(DenialCode::PaymentIdConflict));
    }
    Ok(Some(record.clone()))
}

/// Rechecks financial limits against stored owner state and returns replacements.
/// Authentication, full policy, signature, storage pricing and real backing are
/// the adapter's responsibility before persisting/scheduling a new transfer.
pub fn reserve_payment(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    invoice: &InvoiceV1,
    credential: Option<&CredentialRef>,
    existing: Option<&PaymentRecord>,
    now_ns: u64,
) -> Result<PaymentAccounting, PaymentError> {
    use DenialCode as D;
    use PaymentError as E;
    if actor.owner_id != invoice.owner_id {
        return Err(E::Denied(D::Unauthorized));
    }
    if let Some(payment) = existing_payment(existing, invoice)? {
        return Ok(PaymentAccounting {
            actor: actor.clone(),
            liabilities,
            payment,
            duplicate: true,
        });
    }
    let amount = invoice.amount_yocto.0;
    if amount == 0 {
        return Err(E::Denied(D::InvalidInvoice));
    }
    let session = actor
        .sessions
        .get(&invoice.session_id)
        .ok_or(E::Denied(D::Unauthorized))?;
    if amount > session.purchase_cap_yocto.0 {
        return Err(E::Denied(D::PurchaseCap));
    }
    let usage = actor.usage.snapshot(now_ns);
    let exposure = usage
        .settled_current_day_yocto
        .checked_add(actor.ledger.pending_payment_yocto.0)
        .and_then(|total| total.checked_add(amount));
    if exposure.is_none_or(|total| total > actor.policy.daily_cap_yocto.0) {
        return Err(E::Denied(D::DailyCap));
    }
    let minute = now_ns / MINUTE_NS;
    let attempts = if usage.minute_bucket == minute {
        usage.dispatched_in_minute
    } else {
        0
    };
    if attempts >= actor.policy.max_dispatches_per_minute {
        return Err(E::Denied(D::RateLimit));
    }
    let available = actor
        .ledger
        .available_yocto
        .0
        .checked_sub(amount)
        .ok_or(E::Denied(D::InsufficientFunds))?;
    let day = now_ns / DAY_NS;
    if usage.outstanding_transfers >= MAX_OUTSTANDING_TRANSFERS
        || usage.retained_payments >= MAX_RETAINED_PAYMENTS
        || (!actor.usage.settled_by_dispatch_day.contains_key(&day)
            && actor.usage.settled_by_dispatch_day.len() >= MAX_RETAINED_PAYMENTS as usize)
    {
        return Err(E::Denied(D::Capacity));
    }
    let total_available = liabilities
        .available_yocto
        .checked_sub(amount)
        .ok_or(E::InconsistentState)?;
    let pending = actor
        .ledger
        .pending_payment_yocto
        .0
        .checked_add(amount)
        .ok_or(E::ArithmeticOverflow)?;
    let dispatched = attempts.checked_add(1).ok_or(E::ArithmeticOverflow)?;
    let outstanding = usage
        .outstanding_transfers
        .checked_add(1)
        .ok_or(E::ArithmeticOverflow)?;
    let retained = usage
        .retained_payments
        .checked_add(1)
        .ok_or(E::ArithmeticOverflow)?;

    let mut updated = actor.clone();
    updated.ledger.available_yocto = U128String(available);
    updated.ledger.pending_payment_yocto = U128String(pending);
    updated.usage.minute_bucket = U64String(minute);
    updated.usage.dispatched_in_minute = dispatched;
    updated.usage.outstanding_transfers = outstanding;
    updated.usage.retained_payments = retained;
    // Reserve callback storage now; finalization must never insert a new day.
    updated
        .usage
        .settled_by_dispatch_day
        .entry(day)
        .or_default();
    Ok(PaymentAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: total_available,
            ..liabilities
        },
        payment: PaymentRecord {
            invoice: invoice.clone(),
            invoice_hash: FixedBytes(invoice_hash(invoice)),
            credential: credential.cloned(),
            dispatched_at_ns: U64String(now_ns),
            dispatch_day: U64String(day),
            dispatch_minute: U64String(minute),
            state: PaymentState::Pending,
            finalized_at_ns: U64String(0),
        },
        duplicate: false,
    })
}

/// Only a private callback with one definitive promise result may invoke this.
/// Missing/unknown outcomes are not failure and must leave the payment pending.
pub fn finalize_payment(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    payment: &PaymentRecord,
    outcome: TransferOutcome,
    now_ns: u64,
) -> Result<PaymentAccounting, PaymentError> {
    use PaymentError as E;
    if actor.owner_id != payment.invoice.owner_id {
        return Err(E::InconsistentState);
    }
    if payment.state != PaymentState::Pending {
        return Ok(PaymentAccounting {
            actor: actor.clone(),
            liabilities,
            payment: payment.clone(),
            duplicate: true,
        });
    }
    let amount = payment.invoice.amount_yocto.0;
    if amount == 0
        || actor.usage.retained_payments == 0
        || payment.dispatch_day.0 != payment.dispatched_at_ns.0 / DAY_NS
        || payment.dispatch_minute.0 != payment.dispatched_at_ns.0 / MINUTE_NS
    {
        return Err(E::InconsistentState);
    }
    let pending = actor
        .ledger
        .pending_payment_yocto
        .0
        .checked_sub(amount)
        .ok_or(E::InconsistentState)?;
    let outstanding = actor
        .usage
        .outstanding_transfers
        .checked_sub(1)
        .ok_or(E::InconsistentState)?;
    let original_day = actor
        .usage
        .settled_by_dispatch_day
        .get(&payment.dispatch_day.0)
        .ok_or(E::InconsistentState)?;
    let (available, total_available, settled, state) = match outcome {
        TransferOutcome::Succeeded => (
            actor.ledger.available_yocto.0,
            liabilities.available_yocto,
            original_day
                .0
                .checked_add(amount)
                .ok_or(E::ArithmeticOverflow)?,
            PaymentState::Settled,
        ),
        TransferOutcome::Failed => (
            actor
                .ledger
                .available_yocto
                .0
                .checked_add(amount)
                .ok_or(E::ArithmeticOverflow)?,
            liabilities
                .available_yocto
                .checked_add(amount)
                .ok_or(E::ArithmeticOverflow)?,
            original_day.0,
            PaymentState::Failed,
        ),
    };
    let mut updated = actor.clone();
    updated.ledger.available_yocto = U128String(available);
    updated.ledger.pending_payment_yocto = U128String(pending);
    updated.usage.outstanding_transfers = outstanding;
    *updated
        .usage
        .settled_by_dispatch_day
        .get_mut(&payment.dispatch_day.0)
        .expect("original dispatch day checked above") = U128String(settled);
    let mut finalized = payment.clone();
    finalized.state = state;
    finalized.finalized_at_ns = U64String(now_ns);
    Ok(PaymentAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: total_available,
            ..liabilities
        },
        payment: finalized,
        duplicate: false,
    })
}
