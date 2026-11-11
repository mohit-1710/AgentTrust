# AgentTrust canonical protocol vectors v1

These fixtures test serialization only. They do not assert that an invoice is
admissible, signed, paid, or associated with a qualified service. T04 adds
signature verification; native authorization and runtime evidence come later.

`generate-reference.py` uses only Python `struct`, integer byte conversion,
UTF-8, base64 and SHA-256. Its explicit field list is independent of the Rust
encoder. `vectors.json` records every field's offset and byte length, complete
canonical hexadecimal bytes, and hexadecimal/base64 SHA-256 digests. Tests read
the committed outputs; they do not regenerate expected values from the code
under test. If the protocol changes, regenerate deliberately and review the
field and byte diff.

| Vector | Bytes | Purpose |
|---|---:|---|
| ordinary invoice | 301 | All invoice fields in the frozen order |
| unicode-large invoice | 305 | `audit-₹` is 9 UTF-8 bytes; amount/time are 2^53+1 |
| integer-maxima invoice | 411 | U128/U64/U32 maxima; 64-byte account/profile IDs |
| identity descriptor | 212 | Separate domain, challenge nonce and registered public key |

The unicode-large invoice digest is
`32caccb233701515d3ece818dd7028f0ca72646b6ee766655963f0f36b917a6f`;
the descriptor digest is
`5b2d554f99c678a89745b7b3302e9d85594991fa383c4319474f21273750ba35`.
Both were checked by a separate Python calculation against the architecture.
The maxima vector intentionally has equal issue/expiry dates: it tests integer
encoding, not admission rules.

Invoice domain: ASCII `AGENTTRUST_NEAR_INVOICE_V1` followed by a zero byte
(27 bytes total). Identity domain: ASCII `AGENTTRUST_NEAR_IDENTITY_V1` followed
by a zero byte (28 bytes total). Append the Borsh fields in the order specified
in [the architecture](../../../docs/sprint/architecture.md). Network and asset
are strings, never Borsh enum tags. Hashes/keys/signatures have fixed raw lengths
without a vector length prefix. Integers use unsigned little-endian encoding.
UTF-8 strings use a four-byte little-endian **byte** length prefix.

For the unicode-large invoice, the profile field starts at 145 and is
`0900000061756469742de282b9`; the 16-byte amount starts at 273 and is
`01000000000020000000000000000000`. The full annotated offsets are in the JSON.

JSON U64/U128 values must be unsigned canonical decimal strings (`0` or a
nonzero digit followed by digits), within their respective ranges. Binary fields
must be canonical padded base64 of exactly 32 or 64 decoded bytes. Whitespace,
unpadded encodings and nonzero unused base64 bits reject. Account IDs use native
NEAR validation. Profile IDs are 1–64 UTF-8 bytes; no Unicode normalization is
performed. DTOs reject unknown fields. Semantic schema/network/asset/time checks
belong to admission, so mutation tests can encode a semantically invalid value.

U8/U32 JSON fields accept finite integral numeric values within range. Thus
`1`, `1.0` and `1e0` encode the same integer, and `-0` encodes zero. This matches
JavaScript's parsed number semantics; the signed message is canonical Borsh,
not raw JSON token spelling. Fractional and out-of-range numbers reject. No
floating-point path exists for money or timestamps, which remain strict strings.
`numeric-tokens.json` supplies 28 shared lexical cases for Rust/TypeScript parity.

`invalid-invoices.json` contains 42 shared field replacements that must reject
when parsing an ordinary invoice. Rust tests additionally cover signature length,
unknown/missing fields, decimal zero, Borsh truncation/trailing bytes and profile
byte boundaries. No private credentials or user data are present.

Run pure checks from the repository root:

```sh
. scripts/env.sh
cargo test --locked -p agenttrust-domain codec
```

## T04 TypeScript and signature checks

The Node-local SDK exposes the same invoice/descriptor encoders and hashes plus
`requestHash`, `verifyInvoiceSignature` and `verifyIdentityDescriptorSignature`.
Encoders reject malformed wire values; signature helpers return false for malformed
or invalid signatures. These helpers verify cryptography only. They do not grant
payment permission or validate current policy, dates, nonce, registry version,
endpoint ownership or credentials.

`signatures.json` contains deterministic signatures over the independent committed
`canonical_hex` bytes. `generate-signatures.mjs` imports no project encoder. It uses
the **public test1 seed from [RFC8032 section7.1](https://www.rfc-editor.org/rfc/rfc8032#section-7.1)**,
checks its known public key and empty-message signature, and signs the fixture
messages directly with Ed25519 (no prehash and no JSON serialization).
**Never use or fund this public test key as a real account or service key.**
The identity fixture retains its synthetic embedded key from T03; a signature over
it proves the message bytes, not that this embedded key matches a registry entry.
The identity validator in T16 must perform that separate comparison.

Verification requires an explicit independently registered public key; it never
selects the descriptor's own key as its trust root. Tests cover mutation of every
invoice/descriptor field, both signature-domain substitutions, wrong keys,
noncanonical scalar/encoding, and bounded weak-key forgery cases. Those cases are
not an exhaustive cryptographic audit or proof of NEAR host verification behavior.

Two request-hash goldens were calculated separately with Python `hashlib` over the
request domain followed by exact UTF-8 CSV bytes. No normalization, trimming, BOM
removal or newline rewriting occurs. Unpaired JavaScript UTF-16 surrogates reject
instead of silently becoming replacement bytes; raw CSV is limited to64KiB.

```sh
. scripts/env.sh
pnpm exec vitest run packages/near-sdk/test/codec.test.ts
pnpm check:fast
```

To deliberately reproduce the public signatures, run
`node fixtures/protocol/v1/generate-signatures.mjs` and inspect the diff. This
ordinary fixture-file operation does not create account keys, access a database,
broadcast a transaction or contact a chain.
