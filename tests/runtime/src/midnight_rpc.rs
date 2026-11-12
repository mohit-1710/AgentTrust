//! Pure wire handling for the separate fixture; no sends or runtime effects.
use anyhow::{Context, Result, bail, ensure};
use near_jsonrpc_primitives::{
    errors::{RpcError, RpcErrorKind},
    types::transactions::RpcTransactionError,
};
use serde_json::{Value, json};

pub fn status_request(hash: &str, sender: &str) -> Value {
    // nearcore 2.14's server-side FINAL wait expires after 10 seconds. Observe
    // immediately instead; only an actual FINAL response is accepted below.
    json!({"tx_hash":hash,"sender_account_id":sender,"wait_until":"NONE"})
}

pub fn decode_response(status: u16, body: &[u8]) -> Result<Value> {
    ensure!(
        (200..300).contains(&status),
        "RPC HTTP {status}: {}",
        String::from_utf8_lossy(body)
    );
    let raw: Value = serde_json::from_slice(body).context("invalid RPC JSON body")?;
    ensure!(
        raw["jsonrpc"] == "2.0" && raw["id"] == "midnight",
        "RPC envelope binding"
    );
    Ok(raw)
}

pub fn is_final(raw: &Value, hash: &str, sender: &str) -> Result<bool> {
    if let Some(error) = raw.get("error") {
        ensure!(raw.get("result").is_none(), "ambiguous RPC result/error");
        let rpc: RpcError = serde_json::from_value(error.clone()).context("invalid RPC error")?;
        if let Some(RpcErrorKind::HandlerError(cause)) = rpc.error_struct {
            if let Ok(RpcTransactionError::UnknownTransaction {
                requested_transaction_hash,
            }) = serde_json::from_value(*cause)
            {
                ensure!(
                    requested_transaction_hash.to_string() == hash,
                    "unknown transaction binding"
                );
                return Ok(false);
            }
        }
        bail!("transaction status RPC failed: {error}");
    }
    let result = &raw["result"];
    if !result["transaction"].is_null() {
        ensure!(
            result["transaction"]["hash"] == hash && result["transaction"]["signer_id"] == sender,
            "transaction binding"
        );
    }
    match result["final_execution_status"].as_str() {
        Some("FINAL") => {
            ensure!(
                result["transaction"].is_object(),
                "FINAL transaction required"
            );
            Ok(true)
        }
        Some("NONE" | "INCLUDED" | "EXECUTED_OPTIMISTIC" | "INCLUDED_FINAL" | "EXECUTED") => {
            Ok(false)
        }
        _ => bail!("missing or unknown transaction execution status"),
    }
}
