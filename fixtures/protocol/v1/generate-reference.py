#!/usr/bin/env python3
"""Independent fixture reference: Python stdlib only, no AgentTrust encoder import.

Each field is listed explicitly in its frozen wire order. Rewriting these files
is deliberate: inspect the diff rather than accepting new output automatically.
"""
import base64
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def b64(data):
    return base64.b64encode(bytes(data)).decode('ascii')


def text(value):
    encoded = value.encode('utf-8')
    return struct.pack('<I', len(encoded)) + encoded


def uint(value, width):
    return int(value).to_bytes(width, 'little', signed=False)


def raw(value):
    return base64.b64decode(value, validate=True)


def vector(name, value, fields, domain):
    data = domain
    offsets = [{"field": "domain", "offset": 0, "length": len(domain)}]
    for key, encode in fields:
        encoded = encode(value[key])
        offsets.append({"field": key, "offset": len(data), "length": len(encoded)})
        data += encoded
    return {"name": name, "input": value, "canonical_hex": data.hex(),
            "sha256_hex": hashlib.sha256(data).hexdigest(),
            "sha256_base64": b64(hashlib.sha256(data).digest()),
            "byte_length": len(data), "fields": offsets}


invoice_fields = [
    ('schema_version', lambda x: uint(x, 1)), ('network', text),
    ('core_account', text), ('owner_id', text), ('session_id', raw),
    ('payment_id', raw), ('policy_revision', lambda x: uint(x, 4)),
    ('profile_id', text), ('profile_revision', lambda x: uint(x, 4)),
    ('service_id', text), ('service_version', lambda x: uint(x, 4)),
    ('payout_account', text), ('endpoint_hash', raw), ('request_hash', raw),
    ('asset', text), ('amount_yocto', lambda x: uint(x, 16)),
    ('issued_at_ns', lambda x: uint(x, 8)), ('expires_at_ns', lambda x: uint(x, 8)),
]
identity_fields = [
    ('schema_version', lambda x: uint(x, 1)), ('network', text),
    ('core_account', text), ('challenge_nonce', raw), ('service_id', text),
    ('service_version', lambda x: uint(x, 4)), ('payout_account', text),
    ('endpoint_hash', raw), ('invoice_key', raw),
    ('issued_at_ns', lambda x: uint(x, 8)), ('expires_at_ns', lambda x: uint(x, 8)),
]
base = {
    'schema_version': 1, 'network': 'near:testnet', 'core_account': 'core.testnet',
    'owner_id': 'owner.testnet', 'session_id': b64(range(32)),
    'payment_id': b64(range(32, 64)), 'policy_revision': 1, 'profile_id': 'audit',
    'profile_revision': 7, 'service_id': 'audit.testnet', 'service_version': 3,
    'payout_account': 'seller.testnet', 'endpoint_hash': b64(range(64, 96)),
    'request_hash': b64(range(96, 128)), 'asset': 'NEAR',
    'amount_yocto': '1000000000000000000000', 'issued_at_ns': '1794358800000000000',
    'expires_at_ns': '1794358920000000000',
}
large = dict(base, profile_id='audit-₹', amount_yocto='9007199254740993',
             issued_at_ns='9007199254740993', expires_at_ns='9007319254740993')
maximum = dict(base, owner_id='a' * 64, profile_id='₹' * 21 + 'a',
               policy_revision=2**32-1, profile_revision=2**32-1,
               service_version=2**32-1, amount_yocto=str(2**128-1),
               issued_at_ns=str(2**64-1), expires_at_ns=str(2**64-1))
identity = {k: large[k] for k, _ in identity_fields if k in large}
identity.update(challenge_nonce=b64(range(32, 64)), invoice_key=b64(range(128, 160)))
fixtures = {
    'schema': 'agenttrust-protocol-vectors-v1',
    'invoices': [vector(name, value, invoice_fields, b'AGENTTRUST_NEAR_INVOICE_V1\0')
                 for name, value in [('ordinary', base), ('unicode-large', large),
                                     ('integer-maxima', maximum)]],
    'identities': [vector('identity-unicode-large-context', identity, identity_fields,
                          b'AGENTTRUST_NEAR_IDENTITY_V1\0')],
}
(ROOT / 'vectors.json').write_text(json.dumps(fixtures, indent=2, ensure_ascii=False) + '\n')
invalid = []


def reject(field, values):
    for value in values:
        invalid.append({'field': field, 'value': value})


reject('amount_yocto', [0, 1.5, None, '', '00', '01', '+1', '-1', ' 1', '1 ', '1.0', '1e3', str(2**128)])
reject('issued_at_ns', [0, '', '01', '+1', '-1', str(2**64)])
reject('schema_version', [-1, 256, 1.5, '1'])
reject('policy_revision', [-1, 2**32, 1.5, '1'])
reject('session_id', [b64(range(31)), b64(range(33)), b64(range(32)).rstrip('='),
                       b64(range(32)) + '\n', 'A' * 42 + 'B=', [0] * 32])
reject('owner_id', ['a', 'a' * 65, 'Owner.testnet', 'bad..testnet', 'bad-_testnet', '-bad.testnet'])
reject('profile_id', ['', 'a' * 65, '₹' * 22])
(ROOT / 'invalid-invoices.json').write_text(json.dumps(invalid, indent=2, ensure_ascii=False) + '\n')
print('Wrote independently encoded protocol fixtures.')

# JSON spelling aliases are parsed values, not signing bytes.
numeric_tokens = []
for field, maximum in [('schema_version', 255), ('policy_revision', 2**32-1)]:
    for token, expected in [('0', 0), ('-0', 0), ('-0.0', 0), ('1', 1),
                            ('1.0', 1), ('1e0', 1), (str(maximum), maximum),
                            (str(maximum) + '.0', maximum)]:
        numeric_tokens.append(dict(field=field, token=token, expected=expected))
    for token in ['-1', '-1.0', '1.5', str(maximum+1), str(maximum+1) + '.0', '1e309']:
        numeric_tokens.append(dict(field=field, token=token, expected=None))
(ROOT / 'numeric-tokens.json').write_text(json.dumps(numeric_tokens, indent=2) + '\n')
