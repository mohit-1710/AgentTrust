//! Explicit pure test target. Ordinary enum/JSON values only; no Sandbox, RPC,
//! filesystem persistence, runtime, chain, account or transaction operation.
#[path = "../src/rpc_rejections.rs"]
mod rpc_rejections;
use near_jsonrpc_client::{
    errors::{JsonRpcError, JsonRpcServerError, JsonRpcTransportSendError, RpcTransportError},
    methods::broadcast_tx_async::RpcBroadcastTxAsyncError,
};
use near_jsonrpc_primitives::{
    errors::{RpcError, ServerError},
    types::transactions::RpcTransactionError,
};
use near_primitives::errors::{InvalidAccessKeyError, InvalidTxError, TxExecutionError};
use near_workspaces::error::{ErrorKind, RpcErrorCode};
use rpc_rejections::{KeyRejection, rejection_evidence};
use serde_json::json;
fn wrapped(context: InvalidAccessKeyError) -> near_workspaces::error::Error {
    let rpc: JsonRpcError<RpcTransactionError> = JsonRpcError::ServerError(
        JsonRpcServerError::HandlerError(RpcTransactionError::InvalidTransaction {
            context: InvalidTxError::InvalidAccessKeyError(context),
        }),
    );
    near_workspaces::error::Error::custom(ErrorKind::Rpc(RpcErrorCode::BroadcastTxFailure), rpc)
}
#[test]
fn typed_wrapped_protocol_errors_survive_lossy_outer_display() {
    for (context, expected) in [
        (
            InvalidAccessKeyError::MethodNameMismatch {
                method_name: "set_policy".into(),
            },
            KeyRejection::MethodNameMismatch,
        ),
        (
            InvalidAccessKeyError::ReceiverMismatch {
                tx_receiver: "other.near".parse().unwrap(),
                ak_receiver: "core.near".into(),
            },
            KeyRejection::ReceiverMismatch,
        ),
        (
            InvalidAccessKeyError::DepositWithFunctionCall,
            KeyRejection::DepositWithFunctionCall,
        ),
        (
            InvalidAccessKeyError::RequiresFullAccess,
            KeyRejection::RequiresFullAccess,
        ),
    ] {
        let error = wrapped(context);
        assert!(
            !error.to_string().contains(expected.label()),
            "regression fixture must reproduce the lossy Display"
        );
        let (kind, evidence) = rejection_evidence(&error);
        assert_eq!(kind, Some(expected));
        assert_eq!(evidence["classification"], expected.label());
        assert_eq!(
            evidence["typed_rpc_source"],
            "JsonRpcError<RpcTransactionError>"
        );
        assert!(evidence["source_chain"].as_array().unwrap().len() >= 2);
        assert!(
            evidence["protocol_error"]
                .get("InvalidAccessKeyError")
                .is_some()
        );
    }
}
#[test]
fn nested_workspace_wrapper_still_finds_actual_typed_rpc_cause() {
    let error = near_workspaces::error::Error::custom(
        ErrorKind::Other,
        wrapped(InvalidAccessKeyError::RequiresFullAccess),
    );
    assert_eq!(
        rejection_evidence(&error).0,
        Some(KeyRejection::RequiresFullAccess)
    );
}
#[test]
fn async_noncontextual_legacy_data_uses_typed_invalid_transaction() {
    let data = json!(ServerError::TxExecutionError(
        TxExecutionError::InvalidTxError(InvalidTxError::InvalidAccessKeyError(
            InvalidAccessKeyError::DepositWithFunctionCall
        ))
    ));
    let raw = RpcError::new(-32000, "Server error".into(), Some(data));
    let rpc: JsonRpcError<RpcBroadcastTxAsyncError> =
        JsonRpcError::ServerError(JsonRpcServerError::NonContextualError(raw));
    let error = near_workspaces::error::Error::custom(
        ErrorKind::Rpc(RpcErrorCode::BroadcastTxFailure),
        rpc,
    );
    let (kind, evidence) = rejection_evidence(&error);
    assert_eq!(kind, Some(KeyRejection::DepositWithFunctionCall));
    assert_eq!(
        evidence["typed_rpc_source"],
        "JsonRpcError<RpcBroadcastTxAsyncError>"
    );
    assert!(evidence["raw_rpc_error"].is_object());
}
#[test]
fn transport_failure_and_spoofed_protocol_words_never_pass() {
    let rpc: JsonRpcError<RpcTransactionError> =
        JsonRpcError::TransportError(RpcTransportError::SendError(
            JsonRpcTransportSendError::PayloadSerializeError(std::io::Error::new(
                std::io::ErrorKind::ConnectionReset,
                "InvalidAccessKeyError RequiresFullAccess",
            )),
        ));
    let error = near_workspaces::error::Error::custom(
        ErrorKind::Rpc(RpcErrorCode::BroadcastTxFailure),
        rpc,
    );
    assert_eq!(rejection_evidence(&error).0, None);
    let error = near_workspaces::error::Error::custom(
        ErrorKind::Other,
        std::io::Error::other("InvalidAccessKeyError RequiresFullAccess"),
    );
    assert_eq!(rejection_evidence(&error).0, None);
    let raw = RpcError::new(
        -32000,
        "InvalidAccessKeyError RequiresFullAccess".into(),
        Some(json!("InvalidAccessKeyError RequiresFullAccess")),
    );
    let rpc: JsonRpcError<RpcBroadcastTxAsyncError> =
        JsonRpcError::ServerError(JsonRpcServerError::NonContextualError(raw));
    assert_eq!(
        rejection_evidence(&near_workspaces::error::Error::custom(
            ErrorKind::Other,
            rpc
        ))
        .0,
        None
    );
}
#[test]
fn unrelated_invalid_transaction_and_missing_key_are_not_permission_proof() {
    let rpc: JsonRpcError<RpcTransactionError> = JsonRpcError::ServerError(
        JsonRpcServerError::HandlerError(RpcTransactionError::InvalidTransaction {
            context: InvalidTxError::InvalidSignature,
        }),
    );
    assert_eq!(
        rejection_evidence(&near_workspaces::error::Error::custom(
            ErrorKind::Other,
            rpc
        ))
        .0,
        None
    );
    let key = near_crypto::SecretKey::from_seed(
        near_crypto::KeyType::ED25519,
        "public pure test fixture",
    )
    .public_key();
    let error = wrapped(InvalidAccessKeyError::AccessKeyNotFound {
        account_id: "owner.near".parse().unwrap(),
        public_key: Box::new(key),
    });
    assert_eq!(rejection_evidence(&error).0, None);
}
