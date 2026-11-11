//! Pure protocol values and calculations. No chain runtime, database or network.

pub mod codec;
pub mod policy;
pub mod types;

#[cfg(test)]
mod tests {
    #[test]
    fn toolchain_borsh_preserves_u128_bytes() {
        let value = u128::MAX;
        let bytes = borsh::to_vec(&value).expect("u128 encoding");
        assert_eq!(bytes, [255; 16]);
        assert_eq!(borsh::from_slice::<u128>(&bytes).unwrap(), value);
    }
}

pub mod authority;
pub mod owner;

pub mod accounting;

pub mod registry;

pub mod payments;
