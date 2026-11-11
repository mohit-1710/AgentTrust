use agenttrust_domain::{
    codec::{
        IDENTITY_DOMAIN, INVOICE_DOMAIN, encode_identity_descriptor, encode_invoice,
        identity_descriptor_hash, invoice_hash,
    },
    types::{
        FixedBytes, Hash32, IdentityDescriptorV1, InvoiceV1, ProfileId, Signature64,
        SignedInvoiceV1, U64String, U128String,
    },
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};

fn vectors() -> Value {
    serde_json::from_str(include_str!("../../../fixtures/protocol/v1/vectors.json")).unwrap()
}
fn invoice() -> InvoiceV1 {
    serde_json::from_value(vectors()["invoices"][0]["input"].clone()).unwrap()
}
fn unhex(text: &str) -> Vec<u8> {
    assert_eq!(text.len() % 2, 0);
    (0..text.len())
        .step_by(2)
        .map(|offset| u8::from_str_radix(&text[offset..offset + 2], 16).unwrap())
        .collect()
}

#[test]
fn codec_invoice_matches_independent_field_order_bytes_and_hashes() {
    for vector in vectors()["invoices"].as_array().unwrap() {
        let invoice: InvoiceV1 = serde_json::from_value(vector["input"].clone()).unwrap();
        let expected = unhex(vector["canonical_hex"].as_str().unwrap());
        assert_eq!(encode_invoice(&invoice), expected, "{}", vector["name"]);
        assert_eq!(
            invoice_hash(&invoice).as_slice(),
            unhex(vector["sha256_hex"].as_str().unwrap())
        );
        assert_eq!(serde_json::to_value(&invoice).unwrap(), vector["input"]);
        assert_eq!(
            borsh::from_slice::<InvoiceV1>(&expected[INVOICE_DOMAIN.len()..]).unwrap(),
            invoice
        );
    }
}

#[test]
fn codec_descriptor_matches_independent_bytes_and_hash() {
    let vector = &vectors()["identities"][0];
    let descriptor: IdentityDescriptorV1 = serde_json::from_value(vector["input"].clone()).unwrap();
    let expected = unhex(vector["canonical_hex"].as_str().unwrap());
    assert_eq!(encode_identity_descriptor(&descriptor), expected);
    assert_eq!(
        identity_descriptor_hash(&descriptor).as_slice(),
        unhex(vector["sha256_hex"].as_str().unwrap())
    );
    assert_eq!(serde_json::to_value(&descriptor).unwrap(), vector["input"]);
    assert_eq!(
        borsh::from_slice::<IdentityDescriptorV1>(&expected[IDENTITY_DOMAIN.len()..]).unwrap(),
        descriptor
    );
}

#[test]
fn codec_preserves_large_integers_and_utf8_byte_lengths() {
    let invoice: InvoiceV1 =
        serde_json::from_value(vectors()["invoices"][1]["input"].clone()).unwrap();
    let bytes = encode_invoice(&invoice);
    assert_eq!(bytes.len(), 305);
    assert_eq!(&bytes[145..158], &unhex("0900000061756469742de282b9"));
    assert_eq!(&bytes[273..289], &unhex("01000000000020000000000000000000"));
    assert_eq!(invoice.amount_yocto.0, 9_007_199_254_740_993);
    let max: InvoiceV1 = serde_json::from_value(vectors()["invoices"][2]["input"].clone()).unwrap();
    assert_eq!(max.amount_yocto.0, u128::MAX);
    assert_eq!(max.issued_at_ns.0, u64::MAX);
    assert_eq!(max.policy_revision, u32::MAX);
    assert_eq!(max.owner_id.as_str().len(), 64);
    assert_eq!(max.profile_id.as_str().len(), 64);
}

#[test]
fn codec_rejects_shared_malformed_json_values() {
    let bad: Vec<Value> = serde_json::from_str(include_str!(
        "../../../fixtures/protocol/v1/invalid-invoices.json"
    ))
    .unwrap();
    for case in bad {
        let mut value = vectors()["invoices"][0]["input"].clone();
        let field = case["field"].as_str().unwrap();
        value[field] = case["value"].clone();
        assert!(
            serde_json::from_value::<InvoiceV1>(value).is_err(),
            "accepted {case}"
        );
    }
}

#[test]
fn codec_rejects_unknown_and_missing_signed_fields() {
    let mut value = vectors()["invoices"][0]["input"].clone();
    value["unsigned_payout"] = json!("other.testnet");
    assert!(serde_json::from_value::<InvoiceV1>(value).is_err());
    let mut value = vectors()["invoices"][0]["input"].clone();
    value.as_object_mut().unwrap().remove("request_hash");
    assert!(serde_json::from_value::<InvoiceV1>(value).is_err());
}

#[test]
fn codec_signature_is_exactly_64_canonical_base64_bytes() {
    for length in [63, 65] {
        let signed = json!({"invoice": vectors()["invoices"][0]["input"], "signature": STANDARD.encode(vec![0; length])});
        assert!(serde_json::from_value::<SignedInvoiceV1>(signed).is_err());
    }
    let signed = SignedInvoiceV1 {
        invoice: invoice(),
        signature: FixedBytes([0; 64]),
    };
    let encoded = serde_json::to_value(&signed).unwrap();
    assert_eq!(encoded["signature"], STANDARD.encode([0; 64]));
    assert_eq!(
        serde_json::from_value::<SignedInvoiceV1>(encoded).unwrap(),
        signed
    );
    assert!(serde_json::from_value::<Signature64>(json!("A".repeat(86) + "==")).is_ok());
    assert!(serde_json::from_value::<Signature64>(json!("A".repeat(85) + "B==")).is_err());
}

#[test]
fn codec_binary_fields_reject_truncation_and_trailing_bytes() {
    assert!(borsh::from_slice::<Hash32>(&[0; 31]).is_err());
    assert!(borsh::from_slice::<Hash32>(&[0; 33]).is_err());
    assert!(borsh::from_slice::<Signature64>(&[0; 63]).is_err());
    assert!(borsh::from_slice::<Signature64>(&[0; 65]).is_err());
    let mut bytes = borsh::to_vec(&invoice()).unwrap();
    assert!(borsh::from_slice::<InvoiceV1>(&bytes[..bytes.len() - 1]).is_err());
    bytes.push(0);
    assert!(borsh::from_slice::<InvoiceV1>(&bytes).is_err());
}

#[test]
fn codec_profile_bound_uses_bytes_without_normalizing() {
    assert!(ProfileId::new("₹".repeat(21) + "a").is_ok());
    assert!(ProfileId::new("₹".repeat(22)).is_err());
    assert!(ProfileId::new(String::new()).is_err());
    assert_ne!(
        ProfileId::new("é".into()).unwrap(),
        ProfileId::new("e\u{301}".into()).unwrap()
    );
    assert!(borsh::from_slice::<ProfileId>(&borsh::to_vec(&"a".repeat(65)).unwrap()).is_err());
}

#[test]
fn codec_decimal_zero_is_canonical_and_bounds_are_fixed_width() {
    assert_eq!(serde_json::from_str::<U128String>("\"0\"").unwrap().0, 0);
    assert_eq!(serde_json::from_str::<U64String>("\"0\"").unwrap().0, 0);
    assert_eq!(
        serde_json::to_string(&U128String(u128::MAX)).unwrap(),
        format!("\"{}\"", u128::MAX)
    );
    assert_eq!(borsh::to_vec(&U128String(u128::MAX)).unwrap(), [255; 16]);
    assert_eq!(borsh::to_vec(&U64String(u64::MAX)).unwrap(), [255; 8]);
}

#[test]
fn codec_domains_are_distinct_and_semantic_checks_remain_admission_work() {
    assert_eq!(INVOICE_DOMAIN, b"AGENTTRUST_NEAR_INVOICE_V1\0");
    assert_eq!(IDENTITY_DOMAIN, b"AGENTTRUST_NEAR_IDENTITY_V1\0");
    assert_ne!(INVOICE_DOMAIN, IDENTITY_DOMAIN);
    let original = invoice();
    let mut altered = original.clone();
    altered.network = "near:other".into();
    altered.asset = "OTHER".into();
    altered.schema_version = 2;
    assert_ne!(encode_invoice(&original), encode_invoice(&altered));
}

#[test]
fn codec_numeric_tokens_match_typescript_integral_number_semantics() {
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../../fixtures/protocol/v1/numeric-tokens.json"
    ))
    .unwrap();
    let source = serde_json::to_string(&vectors()["invoices"][0]["input"]).unwrap();
    for case in cases {
        let field = case["field"].as_str().unwrap();
        let token = case["token"].as_str().unwrap();
        let original = format!("\"{field}\":1");
        assert!(source.contains(&original));
        let changed = source.replacen(&original, &format!("\"{field}\":{token}"), 1);
        let parsed = serde_json::from_str::<InvoiceV1>(&changed);
        if case["expected"].is_null() {
            assert!(parsed.is_err(), "accepted {case}");
        } else {
            let value = serde_json::to_value(
                parsed.unwrap_or_else(|error| panic!("rejected {case}: {error}")),
            )
            .unwrap();
            assert_eq!(value[field], case["expected"], "{case}");
        }
    }
}
