//! Pure protocol values and calculations. No chain runtime, database or network.

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
