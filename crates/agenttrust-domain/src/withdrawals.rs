//! Owner-only available-fund withdrawals. Host authority and backing stay in the adapter.
use crate::{
    accounting::{AggregateLiabilities, TransferOutcome},
    owner::ActorState,
    policy::{BackingSnapshot, MAX_OUTSTANDING_TRANSFERS},
    types::{AccountId, Hash32, U64String, U128String},
};
use borsh::{BorshDeserialize, BorshSerialize};
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
#[serde(rename_all = "snake_case")]
pub enum WithdrawalState {
    Pending,
    Succeeded,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct WithdrawalRecord {
    pub owner_id: AccountId,
    pub withdrawal_id: Hash32,
    pub amount_yocto: U128String,
    pub dispatched_at_ns: U64String,
    pub state: WithdrawalState,
    pub finalized_at_ns: U64String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WithdrawalError {
    IdConflict,
    InvalidAmount,
    InsufficientFunds,
    StorageCredit,
    InsufficientBacking,
    Capacity,
    InconsistentState,
    ArithmeticOverflow,
}
impl WithdrawalError {
    pub fn code(self) -> &'static str {
        match self {
            Self::IdConflict => "WITHDRAWAL_ID_CONFLICT",
            Self::InvalidAmount => "INVALID_AMOUNT",
            Self::InsufficientFunds => "INSUFFICIENT_FUNDS",
            Self::StorageCredit => "STORAGE_CREDIT",
            Self::InsufficientBacking => "INSUFFICIENT_BACKING",
            Self::Capacity => "CAPACITY",
            Self::InconsistentState => "INCONSISTENT_STATE",
            Self::ArithmeticOverflow => "ARITHMETIC_OVERFLOW",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WithdrawalAccounting {
    pub actor: ActorState,
    pub liabilities: AggregateLiabilities,
    pub withdrawal: WithdrawalRecord,
    pub duplicate: bool,
}

pub fn existing_withdrawal(
    existing: Option<&WithdrawalRecord>,
    owner_id: &AccountId,
    withdrawal_id: &Hash32,
    amount: U128String,
) -> Result<Option<WithdrawalRecord>, WithdrawalError> {
    let Some(record) = existing else {
        return Ok(None);
    };
    if &record.owner_id != owner_id
        || &record.withdrawal_id != withdrawal_id
        || record.amount_yocto != amount
    {
        return Err(WithdrawalError::IdConflict);
    }
    Ok(Some(record.clone()))
}

/// Call after direct one-yocto owner authentication. Exact retries precede current
/// balance/storage/backing checks and never schedule another transfer.
pub fn reserve_withdrawal(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    withdrawal_id: Hash32,
    amount: U128String,
    existing: Option<&WithdrawalRecord>,
    now_ns: u64,
) -> Result<WithdrawalAccounting, WithdrawalError> {
    use WithdrawalError as E;
    if let Some(withdrawal) =
        existing_withdrawal(existing, &actor.owner_id, &withdrawal_id, amount)?
    {
        return Ok(WithdrawalAccounting {
            actor: actor.clone(),
            liabilities,
            withdrawal,
            duplicate: true,
        });
    }
    if amount.0 == 0 {
        return Err(E::InvalidAmount);
    }
    let available = actor
        .ledger
        .available_yocto
        .0
        .checked_sub(amount.0)
        .ok_or(E::InsufficientFunds)?;
    if actor.usage.outstanding_transfers >= MAX_OUTSTANDING_TRANSFERS {
        return Err(E::Capacity);
    }
    let total_available = liabilities
        .available_yocto
        .checked_sub(amount.0)
        .ok_or(E::InconsistentState)?;
    let outstanding = actor
        .usage
        .outstanding_transfers
        .checked_add(1)
        .ok_or(E::ArithmeticOverflow)?;
    let mut updated = actor.clone();
    updated.ledger.available_yocto = U128String(available);
    updated.usage.outstanding_transfers = outstanding;
    Ok(WithdrawalAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: total_available,
            ..liabilities
        },
        withdrawal: WithdrawalRecord {
            owner_id: actor.owner_id.clone(),
            withdrawal_id,
            amount_yocto: amount,
            dispatched_at_ns: U64String(now_ns),
            state: WithdrawalState::Pending,
            finalized_at_ns: U64String(0),
        },
        duplicate: false,
    })
}

/// Uses the current stored record and one definitive authenticated promise result.
/// Success never changes worker daily/rate usage. Failure restores only the original
/// available claim; actual liquid backing must still be checked on the next outflow.
pub fn finalize_withdrawal(
    actor: &ActorState,
    liabilities: AggregateLiabilities,
    withdrawal: &WithdrawalRecord,
    outcome: TransferOutcome,
    now_ns: u64,
) -> Result<WithdrawalAccounting, WithdrawalError> {
    use WithdrawalError as E;
    if actor.owner_id != withdrawal.owner_id {
        return Err(E::InconsistentState);
    }
    if withdrawal.state != WithdrawalState::Pending {
        return Ok(WithdrawalAccounting {
            actor: actor.clone(),
            liabilities,
            withdrawal: withdrawal.clone(),
            duplicate: true,
        });
    }
    let amount = withdrawal.amount_yocto.0;
    if amount == 0 {
        return Err(E::InconsistentState);
    }
    let outstanding = actor
        .usage
        .outstanding_transfers
        .checked_sub(1)
        .ok_or(E::InconsistentState)?;
    let (available, total_available, state) = match outcome {
        TransferOutcome::Succeeded => (
            actor.ledger.available_yocto.0,
            liabilities.available_yocto,
            WithdrawalState::Succeeded,
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
            WithdrawalState::Failed,
        ),
    };
    let mut updated = actor.clone();
    updated.ledger.available_yocto = U128String(available);
    updated.usage.outstanding_transfers = outstanding;
    let mut finalized = withdrawal.clone();
    finalized.state = state;
    finalized.finalized_at_ns = U64String(now_ns);
    Ok(WithdrawalAccounting {
        actor: updated,
        liabilities: AggregateLiabilities {
            available_yocto: total_available,
            ..liabilities
        },
        withdrawal: finalized,
        duplicate: false,
    })
}

/// Pre-write observations use original aggregate available claims. Project the
/// same bounded storage charge into both stake and unused credit.
pub fn precheck_withdrawal_backing(
    actor: &ActorState,
    backing: BackingSnapshot,
) -> Result<(), WithdrawalError> {
    use WithdrawalError as E;
    if actor.ledger.storage_credit_yocto.0 < backing.storage_charge_yocto {
        return Err(E::StorageCredit);
    }
    let remaining_credit = backing
        .aggregate_storage_credit_yocto
        .checked_sub(backing.storage_charge_yocto)
        .ok_or(E::StorageCredit)?;
    let projected_stake = backing
        .storage_stake_yocto
        .checked_add(backing.storage_charge_yocto)
        .ok_or(E::ArithmeticOverflow)?;
    let required = crate::payments::required_before_transfer(
        projected_stake,
        backing.operating_reserve_yocto,
        AggregateLiabilities {
            available_yocto: backing.aggregate_available_yocto,
            storage_credit_yocto: remaining_credit,
        },
        0, // Snapshot A is still the original pre-reservation aggregate.
    )
    .ok_or(E::ArithmeticOverflow)?;
    if backing.runtime_balance_yocto < required {
        return Err(E::InsufficientBacking);
    }
    Ok(())
}

/// Exact record plus512 bytes for the bounded owner/ID key, prefix and trie-record
/// overhead. Actor counters/root are fixed width and no owner index is allocated.
/// The adapter still bills actual growth and aborts before transfer if exceeded.
pub fn withdrawal_storage_bound(record: &WithdrawalRecord) -> u64 {
    (borsh::to_vec(record)
        .expect("bounded withdrawal encoding")
        .len() as u64)
        .saturating_add(512)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WithdrawalDisplayState {
    Pending,
    Succeeded,
    Failed,
    NeedsReconciliation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct WithdrawalView {
    #[serde(flatten)]
    pub record: WithdrawalRecord,
    pub payout_account: AccountId,
    pub display_state: WithdrawalDisplayState,
}
impl WithdrawalView {
    pub fn new(record: WithdrawalRecord, now_ns: u64) -> Self {
        let display_state = match record.state {
            WithdrawalState::Pending
                if now_ns.saturating_sub(record.dispatched_at_ns.0) >= 120_000_000_000 =>
            {
                WithdrawalDisplayState::NeedsReconciliation
            }
            WithdrawalState::Pending => WithdrawalDisplayState::Pending,
            WithdrawalState::Succeeded => WithdrawalDisplayState::Succeeded,
            WithdrawalState::Failed => WithdrawalDisplayState::Failed,
        };
        Self {
            payout_account: record.owner_id.clone(),
            record,
            display_state,
        }
    }
}
