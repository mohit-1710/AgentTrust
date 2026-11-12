//! USER-RUN SANDBOX FIXTURE ONLY. Never deploy this helper as AgentTrust core.
use near_sdk::{
    AccountId, Gas, NearToken, Promise, env, near,
    serde_json::{self, Value},
};

#[near(contract_state)]
#[derive(Default)]
pub struct RuntimeHelper;

#[near]
impl RuntimeHelper {
    /// Preserve the transaction signer/key while changing the core predecessor.
    pub fn forward_payment(
        &self,
        core_account: AccountId,
        quote: Value,
        credential: Option<Value>,
    ) -> Promise {
        env::log_str("AGENTTRUST_RUNTIME_HELPER_ONLY: forward_payment");
        Promise::new(core_account).function_call(
            "execute_payment",
            serde_json::to_vec(&serde_json::json!({"quote":quote,"credential":credential}))
                .unwrap(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(150),
        )
    }

    /// Both promises are created while this owner exists. The real DeleteAccount
    /// must complete before the already-created owner-authorized core call.
    pub fn delete_then_withdraw(
        &self,
        core_account: AccountId,
        beneficiary_id: AccountId,
        withdrawal_id: String,
        amount_yocto: String,
    ) -> Promise {
        let owner = env::current_account_id();
        assert_eq!(env::predecessor_account_id(), owner, "OWNER_SELF_CALL_ONLY");
        assert_eq!(env::signer_account_id(), owner, "OWNER_SELF_CALL_ONLY");
        assert_ne!(beneficiary_id, owner, "SEPARATE_BENEFICIARY_REQUIRED");
        env::log_str("AGENTTRUST_RUNTIME_HELPER_ONLY: delete_then_withdraw");
        Promise::new(owner).delete_account(beneficiary_id).then(
            Promise::new(core_account).function_call(
                "withdraw_available",
                serde_json::to_vec(
                    &serde_json::json!({"withdrawal_id":withdrawal_id,"amount_yocto":amount_yocto}),
                )
                .unwrap(),
                NearToken::from_yoctonear(1),
                Gas::from_tgas(150),
            ),
        )
    }
}
