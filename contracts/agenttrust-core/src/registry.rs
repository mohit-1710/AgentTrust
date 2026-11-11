use crate::{AgentTrustCore, AgentTrustCoreExt};
use agenttrust_domain::{
    registry::{
        self as domain, Credential, CredentialAssertion, RegistryError, ServiceIdentity,
        ServiceUpdate,
    },
    types::{Hash32, PublicKey32},
};
use near_sdk::{AccountId, env, near};

fn must<T>(result: Result<T, RegistryError>) -> T {
    result.unwrap_or_else(|error| env::panic_str(error.code()))
}

#[near]
impl AgentTrustCore {
    #[payable]
    pub fn set_service(
        &mut self,
        expected_version: Option<u32>,
        payout_account: AccountId,
        invoice_key: PublicKey32,
        endpoint_hash: Hash32,
        active: bool,
    ) -> ServiceIdentity {
        let (merchant_id, actor) = self.managed_actor();
        let existing = self.services.get(&merchant_id);
        let is_new = existing.is_none();
        if is_new && self.service_ids.len() == u32::MAX {
            env::panic_str(RegistryError::Capacity.code());
        }
        let service = must(domain::set_service(
            &merchant_id,
            existing,
            expected_version,
            ServiceUpdate {
                payout_account,
                invoice_key,
                endpoint_hash,
                active,
            },
        ));
        // Include both the identity record and its bounded-access discovery index.
        let storage_before = env::storage_usage();
        self.services.insert(merchant_id.clone(), service.clone());
        if is_new {
            self.service_ids.push(merchant_id.clone());
        }
        self.services.flush();
        self.service_ids.flush();
        self.save_actor_charging_growth(merchant_id, actor, storage_before);
        service
    }

    #[payable]
    pub fn issue_credential(
        &mut self,
        credential_id: Hash32,
        expected_revision: Option<u32>,
        assertion: CredentialAssertion,
    ) -> Credential {
        let (issuer_id, mut actor) = self.managed_actor();
        let key = (issuer_id.clone(), credential_id);
        let issued = must(domain::issue_credential(
            &issuer_id,
            credential_id,
            self.credentials.get(&key),
            expected_revision,
            actor.issued_credential_count,
            assertion.clone(),
            self.services.get(&assertion.service_id),
            env::block_timestamp(),
        ));
        let storage_before = env::storage_usage();
        actor.issued_credential_count = issued.retained_count;
        self.credentials.insert(key, issued.credential.clone());
        self.credentials.flush();
        self.save_actor_charging_growth(issuer_id, actor, storage_before);
        issued.credential
    }

    #[payable]
    pub fn revoke_credential(&mut self, credential_id: Hash32) -> Credential {
        let (issuer_id, actor) = self.managed_actor();
        let key = (issuer_id.clone(), credential_id);
        let existing = self.credentials.get(&key);
        let credential = must(domain::revoke_credential(
            &issuer_id,
            credential_id,
            existing,
        ));
        if existing.is_some_and(|record| record.revoked) {
            return credential;
        }
        let storage_before = env::storage_usage();
        self.credentials.insert(key, credential.clone());
        self.credentials.flush();
        self.save_actor_charging_growth(issuer_id, actor, storage_before);
        credential
    }

    pub fn get_service(&self, service_id: AccountId) -> Option<ServiceIdentity> {
        self.services.get(&service_id).cloned()
    }

    pub fn get_credential(
        &self,
        issuer_id: AccountId,
        credential_id: Hash32,
    ) -> Option<Credential> {
        self.credentials.get(&(issuer_id, credential_id)).cloned()
    }
}
