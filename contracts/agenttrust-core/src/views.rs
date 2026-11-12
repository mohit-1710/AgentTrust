use crate::{AgentTrustCore, AgentTrustCoreExt};
use agenttrust_domain::{
    owner::{AccountLedger, ActorState, OwnerPolicy, Profile, Session, TrustEntry},
    payments::{PaymentView, payment_storage_bound},
    policy::{BackingSnapshot, CredentialEvidence, DAY_NS},
    registry::{CredentialRef, ServiceIdentity},
    types::{Hash32, ProfileId, SignedInvoiceV1, U64String, U128String},
    views::{PreviewResult, PreviewSnapshot, page_indices, preview_payment as domain_preview},
};
use near_sdk::{AccountId, env, near, serde::Serialize};

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CoreConfig {
    pub network: String,
    pub core_account: AccountId,
    pub operating_reserve_yocto: U128String,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OwnerPolicyView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub policy: OwnerPolicy,
    pub trusted_services: Vec<TrustEntry>,
    pub blocked_services: Vec<AccountId>,
    pub blocked_payouts: Vec<AccountId>,
}
impl OwnerPolicyView {
    pub(crate) fn from_actor(actor: &ActorState) -> Self {
        Self {
            owner_id: actor.owner_id.clone(),
            policy: actor.policy.clone(),
            trusted_services: actor.trusted_services.values().cloned().collect(),
            blocked_services: actor.blocked_services.iter().cloned().collect(),
            blocked_payouts: actor.blocked_payouts.iter().cloned().collect(),
        }
    }
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Page<T: Serialize> {
    pub items: Vec<T>,
    pub next_cursor: Option<U64String>,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProfileView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub profile: Profile,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SessionView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub session: Session,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TrustEntryView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub trust: TrustEntry,
}

/// Observed backing inputs only, not a payment authorization or runtime proof.
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultSnapshot {
    pub total_available_yocto: U128String,
    pub total_storage_credit_yocto: U128String,
    pub operating_reserve_yocto: U128String,
    pub runtime_account_balance_yocto: U128String,
    pub storage_usage_bytes: U64String,
    pub storage_byte_cost_yocto: U128String,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AccountLedgerView {
    pub account_id: AccountId,
    #[serde(flatten)]
    pub ledger: AccountLedger,
    pub vault: VaultSnapshot,
    pub usage: AccountUsageView,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AccountUsageView {
    pub current_day: U64String,
    pub settled_current_day_yocto: U128String,
    pub dispatch_minute: U64String,
    pub dispatched_in_minute: u32,
    pub outstanding_transfers: u32,
    pub retained_payments: u32,
}

impl AgentTrustCore {
    pub(crate) fn account_ledger_view(&self, actor: &ActorState) -> AccountLedgerView {
        let now_ns = env::block_timestamp();
        let usage = actor.usage.snapshot(now_ns);
        AccountLedgerView {
            account_id: actor.owner_id.clone(),
            ledger: actor.ledger.clone(),
            usage: AccountUsageView {
                current_day: U64String(now_ns / DAY_NS),
                settled_current_day_yocto: U128String(usage.settled_current_day_yocto),
                dispatch_minute: U64String(usage.minute_bucket),
                dispatched_in_minute: usage.dispatched_in_minute,
                outstanding_transfers: usage.outstanding_transfers,
                retained_payments: usage.retained_payments,
            },
            vault: VaultSnapshot {
                total_available_yocto: U128String(self.total_available_yocto),
                total_storage_credit_yocto: U128String(self.total_storage_credit_yocto),
                operating_reserve_yocto: U128String(self.operating_reserve_yocto),
                runtime_account_balance_yocto: U128String(env::account_balance().as_yoctonear()),
                storage_usage_bytes: U64String(env::storage_usage()),
                storage_byte_cost_yocto: U128String(env::storage_byte_cost().as_yoctonear()),
            },
        }
    }
}

#[near]
impl AgentTrustCore {
    pub fn get_account(&self, account_id: AccountId) -> Option<AccountLedgerView> {
        self.actors
            .get(&account_id)
            .map(|actor| self.account_ledger_view(actor))
    }

    pub fn get_payment(&self, owner_id: AccountId, payment_id: Hash32) -> Option<PaymentView> {
        self.payments
            .get(&(owner_id, payment_id))
            .map(|record| PaymentView::new(record.clone(), env::block_timestamp()))
    }

    pub fn get_config(&self) -> CoreConfig {
        CoreConfig {
            network: self.network.clone(),
            core_account: env::current_account_id(),
            operating_reserve_yocto: U128String(self.operating_reserve_yocto),
        }
    }
    pub fn get_policy(&self, owner_id: AccountId) -> Option<OwnerPolicyView> {
        self.actors.get(&owner_id).map(OwnerPolicyView::from_actor)
    }
    pub fn get_session(&self, owner_id: AccountId, session_id: Hash32) -> Option<SessionView> {
        self.actors
            .get(&owner_id)?
            .sessions
            .get(&session_id)
            .map(|session| SessionView {
                owner_id,
                session: session.clone(),
            })
    }
}

#[near]
impl AgentTrustCore {
    pub fn get_profile(&self, owner_id: AccountId, profile_id: ProfileId) -> Option<ProfileView> {
        self.actors
            .get(&owner_id)?
            .profiles
            .get(&profile_id)
            .map(|profile| ProfileView {
                owner_id,
                profile: profile.clone(),
            })
    }
    /// Cursor is the next append index, in registration order; it grants no trust.
    pub fn list_services(&self, cursor: Option<U64String>, limit: u32) -> Page<ServiceIdentity> {
        let page = page_indices(self.service_ids.len(), cursor, limit, false)
            .unwrap_or_else(|e| env::panic_str(e));
        let items = (page.start..page.end)
            .map(|index| {
                let id = self
                    .service_ids
                    .get(index)
                    .unwrap_or_else(|| env::panic_str("INCONSISTENT_SERVICE_INDEX"));
                self.services
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| env::panic_str("INCONSISTENT_SERVICE_INDEX"))
            })
            .collect();
        Page {
            items,
            next_cursor: page.next_cursor,
        }
    }
    /// Null starts at current length. Subsequent cursors are exclusive insertion
    /// indices, so newly appended records cannot duplicate an earlier page.
    pub fn list_recent_payments(
        &self,
        owner_id: AccountId,
        cursor: Option<U64String>,
        limit: u32,
    ) -> Page<PaymentView> {
        let ids = self.payment_ids.get(&owner_id);
        let total = ids.map_or(0, |ids| ids.len() as u32);
        let page = page_indices(total, cursor, limit, true).unwrap_or_else(|e| env::panic_str(e));
        let items = (page.start..page.end)
            .rev()
            .map(|index| {
                let id = ids
                    .and_then(|ids| ids.get(index as usize))
                    .unwrap_or_else(|| env::panic_str("INCONSISTENT_PAYMENT_INDEX"));
                let record = self
                    .payments
                    .get(&(owner_id.clone(), *id))
                    .unwrap_or_else(|| env::panic_str("INCONSISTENT_PAYMENT_INDEX"));
                PaymentView::new(record.clone(), env::block_timestamp())
            })
            .collect();
        Page {
            items,
            next_cursor: page.next_cursor,
        }
    }
    /// Current new-admission eligibility only, not key possession or an
    /// authenticated exact-replay result. The view never reserves or writes.
    pub fn preview_payment(
        &self,
        quote: SignedInvoiceV1,
        credential: Option<CredentialRef>,
    ) -> PreviewResult {
        let invoice = &quote.invoice;
        let core = env::current_account_id();
        let byte_cost = env::storage_byte_cost().as_yoctonear();
        let snapshot = PreviewSnapshot {
            now_ns: env::block_timestamp(),
            network: &self.network,
            core_account: &core,
            owner: self.actors.get(&invoice.owner_id),
            service: self.services.get(&invoice.service_id),
            backing: BackingSnapshot {
                runtime_balance_yocto: env::account_balance().as_yoctonear(),
                storage_stake_yocto: u128::from(env::storage_usage()).saturating_mul(byte_cost),
                operating_reserve_yocto: self.operating_reserve_yocto,
                aggregate_available_yocto: self.total_available_yocto,
                aggregate_storage_credit_yocto: self.total_storage_credit_yocto,
                storage_charge_yocto: u128::from(payment_storage_bound(
                    &quote,
                    credential.as_ref(),
                ))
                .saturating_mul(byte_cost),
            },
        };
        let evidence = CredentialEvidence {
            reference: credential.as_ref(),
            record: credential.as_ref().and_then(|r| {
                self.credentials
                    .get(&(r.issuer_id.clone(), r.credential_id))
            }),
        };
        domain_preview(&snapshot, &quote, evidence, |signature, bytes, key| {
            env::ed25519_verify(signature, bytes, key)
        })
    }
}
