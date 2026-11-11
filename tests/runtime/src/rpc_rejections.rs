//! Pure protocol-error interpretation; never starts or connects to a runtime.
use near_jsonrpc_client::{
    errors::{JsonRpcError, JsonRpcServerError},
    methods::broadcast_tx_async::RpcBroadcastTxAsyncError,
};
use near_jsonrpc_primitives::{
    errors::{RpcError, RpcErrorKind, ServerError},
    types::transactions::RpcTransactionError,
};
use near_primitives::errors::{InvalidAccessKeyError, InvalidTxError, TxExecutionError};
use serde_json::{Value, json};
use std::error::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyRejection {
    MethodNameMismatch,
    ReceiverMismatch,
    DepositWithFunctionCall,
    RequiresFullAccess,
}
impl KeyRejection {
    pub fn label(self) -> &'static str {
        match self {
            Self::MethodNameMismatch => "MethodNameMismatch",
            Self::ReceiverMismatch => "ReceiverMismatch",
            Self::DepositWithFunctionCall => "DepositWithFunctionCall",
            Self::RequiresFullAccess => "RequiresFullAccess",
        }
    }
}
fn classify_context(context: &InvalidTxError) -> Option<KeyRejection> {
    match context {
        InvalidTxError::InvalidAccessKeyError(InvalidAccessKeyError::MethodNameMismatch {
            ..
        }) => Some(KeyRejection::MethodNameMismatch),
        InvalidTxError::InvalidAccessKeyError(InvalidAccessKeyError::ReceiverMismatch {
            ..
        }) => Some(KeyRejection::ReceiverMismatch),
        InvalidTxError::InvalidAccessKeyError(InvalidAccessKeyError::DepositWithFunctionCall) => {
            Some(KeyRejection::DepositWithFunctionCall)
        }
        InvalidTxError::InvalidAccessKeyError(InvalidAccessKeyError::RequiresFullAccess) => {
            Some(KeyRejection::RequiresFullAccess)
        }
        _ => None,
    }
}
fn legacy_context(rpc: &RpcError) -> Option<InvalidTxError> {
    // Only recognized transaction-handler/legacy payloads are eligible. Human
    // message text and transport/parser failures never establish a restriction.
    match &rpc.error_struct {
        None => {}
        Some(RpcErrorKind::HandlerError(cause))
            if cause["name"] == "INVALID_TRANSACTION"
                || cause.get("TxExecutionError").is_some() => {}
        _ => return None,
    }
    let data = rpc.data.as_ref()?;
    match serde_json::from_value::<ServerError>((**data).clone()).ok()? {
        ServerError::TxExecutionError(TxExecutionError::InvalidTxError(context)) => Some(context),
        _ => None,
    }
}
pub fn rejection_evidence(error: &near_workspaces::error::Error) -> (Option<KeyRejection>, Value) {
    let mut chain = Vec::new();
    let mut current: Option<&(dyn Error + 'static)> = Some(error);
    let mut context = None;
    let mut typed_source = None;
    let mut raw_rpc = None;
    while let Some(cause) = current {
        chain.push(cause.to_string());
        if let Some(rpc) = cause.downcast_ref::<JsonRpcError<RpcTransactionError>>() {
            typed_source = Some("JsonRpcError<RpcTransactionError>");
            match rpc {
                JsonRpcError::ServerError(JsonRpcServerError::HandlerError(
                    RpcTransactionError::InvalidTransaction { context: invalid },
                )) => context = Some(invalid.clone()),
                JsonRpcError::ServerError(JsonRpcServerError::NonContextualError(raw)) => {
                    context = legacy_context(raw);
                    raw_rpc = Some(json!(raw));
                }
                _ => {}
            }
        } else if let Some(rpc) = cause.downcast_ref::<JsonRpcError<RpcBroadcastTxAsyncError>>() {
            typed_source = Some("JsonRpcError<RpcBroadcastTxAsyncError>");
            if let JsonRpcError::ServerError(JsonRpcServerError::NonContextualError(raw)) = rpc {
                context = legacy_context(raw);
                raw_rpc = Some(json!(raw));
            }
        }
        current = cause.source();
    }
    let classification = context.as_ref().and_then(classify_context);
    (
        classification,
        json!({"source_chain":chain,"typed_rpc_source":typed_source,"protocol_error":context,"raw_rpc_error":raw_rpc,"classification":classification.map(KeyRejection::label)}),
    )
}
