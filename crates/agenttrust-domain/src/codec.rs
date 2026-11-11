//! Frozen Borsh order plus a distinct signature domain for each message type.
use crate::types::{IdentityDescriptorV1, InvoiceV1};
use borsh::BorshSerialize;
use sha2::{Digest, Sha256};

pub const INVOICE_DOMAIN: &[u8] = b"AGENTTRUST_NEAR_INVOICE_V1\0";
pub const IDENTITY_DOMAIN: &[u8] = b"AGENTTRUST_NEAR_IDENTITY_V1\0";

pub fn encode_invoice(invoice: &InvoiceV1) -> Vec<u8> {
    encode(INVOICE_DOMAIN, invoice)
}

pub fn invoice_hash(invoice: &InvoiceV1) -> [u8; 32] {
    Sha256::digest(encode_invoice(invoice)).into()
}

pub fn encode_identity_descriptor(descriptor: &IdentityDescriptorV1) -> Vec<u8> {
    encode(IDENTITY_DOMAIN, descriptor)
}

pub fn identity_descriptor_hash(descriptor: &IdentityDescriptorV1) -> [u8; 32] {
    Sha256::digest(encode_identity_descriptor(descriptor)).into()
}

fn encode(domain: &[u8], value: &impl BorshSerialize) -> Vec<u8> {
    let mut bytes = domain.to_vec();
    // Serializing these bounded value fields to a Vec has no fallible I/O.
    value
        .serialize(&mut bytes)
        .expect("canonical value encoding");
    bytes
}
