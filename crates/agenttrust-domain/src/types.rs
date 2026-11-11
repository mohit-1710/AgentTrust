//! Canonical wire values. Semantic admission rules belong to the policy engine.
use base64::{Engine, engine::general_purpose::STANDARD};
use borsh::{BorshDeserialize, BorshSerialize};
pub use near_account_id::AccountId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, BorshSerialize, BorshDeserialize,
)]
pub struct FixedBytes<const N: usize>(pub [u8; N]);
pub type Hash32 = FixedBytes<32>;
pub type PublicKey32 = FixedBytes<32>;
pub type Signature64 = FixedBytes<64>;

impl<const N: usize> Serialize for FixedBytes<N> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&STANDARD.encode(self.0))
    }
}
impl<'de, const N: usize> Deserialize<'de> for FixedBytes<N> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let text = <String as Deserialize>::deserialize(deserializer)?;
        let bytes = STANDARD.decode(&text).map_err(serde::de::Error::custom)?;
        if bytes.len() != N || STANDARD.encode(&bytes) != text {
            return Err(serde::de::Error::custom(format!(
                "expected canonical padded base64 of {N} bytes"
            )));
        }
        let array = bytes
            .try_into()
            .map_err(|_| serde::de::Error::custom("invalid byte length"))?;
        Ok(Self(array))
    }
}

macro_rules! decimal_type {
    ($name:ident, $inner:ty) => {
        #[derive(
            Clone,
            Copy,
            Debug,
            Default,
            PartialEq,
            Eq,
            PartialOrd,
            Ord,
            BorshSerialize,
            BorshDeserialize,
        )]
        pub struct $name(pub $inner);
        impl Serialize for $name {
            fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.serialize_str(&self.0.to_string())
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let text = <String as Deserialize>::deserialize(deserializer)?;
                if text.is_empty()
                    || !text.bytes().all(|byte| byte.is_ascii_digit())
                    || (text.len() > 1 && text.starts_with('0'))
                {
                    return Err(serde::de::Error::custom(
                        "expected canonical unsigned decimal string",
                    ));
                }
                text.parse::<$inner>()
                    .map(Self)
                    .map_err(serde::de::Error::custom)
            }
        }
    };
}
decimal_type!(U128String, u128);
decimal_type!(U64String, u64);

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, BorshSerialize)]
pub struct ProfileId(String);
impl ProfileId {
    pub fn new(value: String) -> Result<Self, &'static str> {
        if value.is_empty() || value.len() > 64 {
            return Err("profile ID must contain 1 to 64 UTF-8 bytes");
        }
        Ok(Self(value))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
impl Serialize for ProfileId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}
impl<'de> Deserialize<'de> for ProfileId {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Self::new(<String as Deserialize>::deserialize(deserializer)?)
            .map_err(serde::de::Error::custom)
    }
}
impl BorshDeserialize for ProfileId {
    fn deserialize_reader<R: std::io::Read>(reader: &mut R) -> std::io::Result<Self> {
        Self::new(String::deserialize_reader(reader)?)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))
    }
}

// JSON numeric token spellings are not signed. Match JavaScript's parsed
// integral-number semantics; all accepted values are exactly representable.
macro_rules! bounded_number {
    ($function:ident, $integer:ty) => {
        fn $function<'de, D: Deserializer<'de>>(deserializer: D) -> Result<$integer, D::Error> {
            struct Visitor;
            impl<'de> serde::de::Visitor<'de> for Visitor {
                type Value = $integer;
                fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                    write!(
                        formatter,
                        "an integral JSON number from 0 to {}",
                        <$integer>::MAX
                    )
                }
                fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<Self::Value, E> {
                    value.try_into().map_err(E::custom)
                }
                fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<Self::Value, E> {
                    value.try_into().map_err(E::custom)
                }
                fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<Self::Value, E> {
                    if value.is_finite()
                        && value.fract() == 0.0
                        && value >= 0.0
                        && value <= <$integer>::MAX as f64
                    {
                        Ok(value as $integer)
                    } else {
                        Err(E::custom(
                            "number must be integral and within the unsigned field range",
                        ))
                    }
                }
            }
            deserializer.deserialize_any(Visitor)
        }
    };
}
bounded_number!(deserialize_u8, u8);
bounded_number!(deserialize_u32, u32);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct InvoiceV1 {
    #[serde(deserialize_with = "deserialize_u8")]
    pub schema_version: u8,
    pub network: String,
    pub core_account: AccountId,
    pub owner_id: AccountId,
    pub session_id: Hash32,
    pub payment_id: Hash32,
    #[serde(deserialize_with = "deserialize_u32")]
    pub policy_revision: u32,
    pub profile_id: ProfileId,
    #[serde(deserialize_with = "deserialize_u32")]
    pub profile_revision: u32,
    pub service_id: AccountId,
    #[serde(deserialize_with = "deserialize_u32")]
    pub service_version: u32,
    pub payout_account: AccountId,
    pub endpoint_hash: Hash32,
    pub request_hash: Hash32,
    pub asset: String,
    pub amount_yocto: U128String,
    pub issued_at_ns: U64String,
    pub expires_at_ns: U64String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct SignedInvoiceV1 {
    pub invoice: InvoiceV1,
    pub signature: Signature64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct IdentityDescriptorV1 {
    #[serde(deserialize_with = "deserialize_u8")]
    pub schema_version: u8,
    pub network: String,
    pub core_account: AccountId,
    pub challenge_nonce: Hash32,
    pub service_id: AccountId,
    #[serde(deserialize_with = "deserialize_u32")]
    pub service_version: u32,
    pub payout_account: AccountId,
    pub endpoint_hash: Hash32,
    pub invoice_key: PublicKey32,
    pub issued_at_ns: U64String,
    pub expires_at_ns: U64String,
}
