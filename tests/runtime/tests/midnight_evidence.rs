#[path = "../src/midnight_rpc.rs"]
mod rpc;
#[path = "../src/midnight_assertions.rs"]
mod rules;
use rules::{DAY_NS, Observed, checks};
use serde_json::json;

#[test]
fn observes_without_server_wait_but_accepts_only_final() {
    let hash = "11111111111111111111111111111111";
    assert_eq!(
        rpc::status_request(hash, "root.test.near")["wait_until"],
        "NONE"
    );
    for status in [
        "NONE",
        "INCLUDED",
        "EXECUTED_OPTIMISTIC",
        "INCLUDED_FINAL",
        "EXECUTED",
        "FINAL",
    ] {
        let raw = json!({"result":{"final_execution_status":status,"transaction":{"hash":hash,"signer_id":"root.test.near"}}});
        assert_eq!(
            rpc::is_final(&raw, hash, "root.test.near").unwrap(),
            status == "FINAL"
        );
    }
    assert!(
        rpc::is_final(
            &json!({"result":{"final_execution_status":"FINAL"}}),
            hash,
            "root.test.near"
        )
        .is_err()
    );
    assert!(
        rpc::is_final(
            &json!({"result":{"final_execution_status":"unrecognized"}}),
            hash,
            "root.test.near"
        )
        .is_err()
    );
    let wrong_binding = json!({"result":{"final_execution_status":"FINAL","transaction":{"hash":hash,"signer_id":"other.test.near"}}});
    assert!(rpc::is_final(&wrong_binding, hash, "root.test.near").is_err());
    assert!(rpc::is_final(&wrong_binding, "other-hash", "other.test.near").is_err());
}

#[test]
fn only_bound_typed_unknown_transaction_is_pending() {
    let hash = "11111111111111111111111111111111";
    let error = near_jsonrpc_primitives::errors::RpcError::from(
        near_jsonrpc_primitives::types::transactions::RpcTransactionError::UnknownTransaction {
            requested_transaction_hash: hash.parse().unwrap(),
        },
    );
    let raw = json!({"error":error});
    assert!(!rpc::is_final(&raw, hash, "root.test.near").unwrap());
    assert!(rpc::is_final(&raw, "other-hash", "root.test.near").is_err());
    for error in [
        json!({"code":-32000,"message":"UNKNOWN_TRANSACTION"}),
        json!({"code":-32000,"message":"Server error","name":"HANDLER_ERROR","cause":{"name":"TIMEOUT_ERROR","info":{"cause":"NOT_OBSERVED"}}}),
        json!({"code":-32000,"message":"Server error","name":"HANDLER_ERROR","cause":{"name":"DOES_NOT_TRACK_SHARD"}}),
    ] {
        assert!(rpc::is_final(&json!({"error":error}), hash, "root.test.near").is_err());
    }
}

#[test]
fn http_error_keeps_exact_body_and_cannot_look_like_final() {
    let body = br#"{"jsonrpc":"2.0","id":"midnight","error":{"name":"HANDLER_ERROR","cause":{"name":"TIMEOUT_ERROR","info":{"cause":"NOT_OBSERVED"}}}}"#;
    let error = rpc::decode_response(408, body).unwrap_err().to_string();
    assert!(error.contains("HTTP 408"));
    assert!(error.contains(std::str::from_utf8(body).unwrap()));
    assert!(
        rpc::decode_response(
            503,
            br#"{"jsonrpc":"2.0","id":"midnight","result":{"final_execution_status":"FINAL"}}"#
        )
        .is_err()
    );
    assert!(rpc::decode_response(200, b"invalid body").is_err());
    assert!(rpc::decode_response(200, br#"{"jsonrpc":"2.0","id":"wrong"}"#).is_err());
    assert!(rpc::decode_response(200, br#"{"jsonrpc":"2.0","id":"midnight","result":{}}"#).is_ok());
}

#[test]
fn explicit_payment_gas_fits_the_finite_protocol_88_allowance() {
    let prepayment = u128::from(rules::PAYMENT_GAS_TGAS) * 1_000_000_000_000 * 1_000_000_000;
    assert_eq!(rules::PAYMENT_GAS_TGAS, 150);
    assert!(rules::WORKER_ALLOWANCE_YOCTO > prepayment + 1_000_000_000_000_000_000_000);
}

fn valid() -> Observed {
    Observed {
        dispatch_ns: DAY_NS - 2,
        edit_ns: DAY_NS,
        callback_ns: DAY_NS,
        amount: 3,
        available_before: 10,
        available_in_edit: 7,
        available_final: 7,
        pending_in_edit: 3,
        pending_final: 0,
        old_day_settled: 3,
        callback_day_settled: 0,
        recipient_delta: 3,
    }
}
#[test]
fn accepts_same_block_edit_only_with_committed_pending_return() {
    assert!(checks(&valid()).iter().all(|(_, pass)| *pass));
    let mut observed = valid();
    observed.pending_in_edit = 0;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
#[test]
fn rejects_same_day_late_edits_and_wrong_day_charges() {
    let mut observed = valid();
    observed.dispatch_ns = DAY_NS;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.edit_ns = observed.callback_ns + 1;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.old_day_settled = 0;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.callback_day_settled = 3;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
#[test]
fn rejects_released_principal_partial_reservation_or_duplicate_payout() {
    let mut observed = valid();
    observed.available_in_edit = 10;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.pending_in_edit = 2;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.recipient_delta = 6;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
