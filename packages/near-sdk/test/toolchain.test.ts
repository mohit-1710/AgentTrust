import { createHash } from "node:crypto";
import { PublicKey } from "near-api-js";
import { describe, expect, it } from "vitest";

describe("toolchain byte-array support", () => {
  it("hashes bytes including values above ASCII without text conversion", () => {
    const bytes = Uint8Array.of(0, 127, 128, 255);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "89273d2f70b93285bb7ddb4bcee86a5347ca7159352e3cbdd20c23e9d1e507d3",
    );
    expect(Buffer.from(bytes).toString("base64")).toBe("AH+A/w==");
  });

  it("loads the pinned NEAR client and round-trips a public key offline", () => {
    const encoded = "ed25519:11111111111111111111111111111111";
    const key = PublicKey.fromString(encoded);
    expect(key.data).toEqual(new Uint8Array(32));
    expect(key.toString()).toBe(encoded);
  });
});
