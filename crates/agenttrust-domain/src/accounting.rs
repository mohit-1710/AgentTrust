//! Checked actor claims over ordinary values; host storage measurement lives in the contract.
use crate::{authority::AuthorityError, owner::ActorState, types::U128String};

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
