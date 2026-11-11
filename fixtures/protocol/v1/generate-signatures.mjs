// Public RFC 8032 test seed only. Never use this key for an account or real funds.
// No project encoder is imported: sign the independent committed Python bytes.
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const seed = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const expectedPublic = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const expectedEmptySignature = "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
  "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
const key = createPrivateKey({
  key: Buffer.from("302e020100300506032b657004220420" + seed, "hex"),
  format: "der", type: "pkcs8",
});
const publicBytes = createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32);
if (publicBytes.toString("hex") !== expectedPublic ||
    sign(null, Buffer.alloc(0), key).toString("hex") !== expectedEmptySignature) {
  throw new Error("RFC 8032 test1 anchor mismatch");
}
const vectors = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url), "utf8"));
const signature = (vector) => ({
  vector: vector.name,
  signature_base64: sign(null, Buffer.from(vector.canonical_hex, "hex"), key).toString("base64"),
});
const result = {
  schema: "agenttrust-protocol-signatures-v1",
  source: "https://www.rfc-editor.org/rfc/rfc8032#section-7.1",
  warning: "Public test seed only; never fund or use this key for a real account.",
  test_seed_hex: seed,
  public_key_base64: publicBytes.toString("base64"),
  rfc8032_empty_signature_hex: expectedEmptySignature,
  invoices: vectors.invoices.map(signature),
  identities: vectors.identities.map(signature),
};
writeFileSync(new URL("./signatures.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log("Wrote deterministic public-test signatures over independent fixture bytes.");
