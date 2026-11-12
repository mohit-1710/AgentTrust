import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyPair, KeyPairSigner, SignedTransaction, baseEncode } from "near-api-js";
import { AgentTrustClient } from "../src/client.js";
import { AgentTrustOwner } from "../src/owner.js";
const core = "core.testnet", owner = "owner.testnet", block = baseEncode(Buffer.alloc(32, 1));
function setup(permission: unknown = "FullAccess") {
  const sent: SignedTransaction[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    const { method, params, id } = JSON.parse(init.body as string);
    let result: unknown;
    if (method === "status") result = { chain_id: "testnet" };
    else if (method === "block") result = { header: { hash: block } };
    else if (method === "query" && params.request_type === "view_access_key") result = { nonce: 0, permission, block_hash: block, block_height: 1 };
    else if (method === "query" && params.method_name === "get_config") result = { result: [...Buffer.from(JSON.stringify({ network: "near:testnet", core_account: core, operating_reserve_yocto: "1" }))], block_hash: block, block_height: 1 };
    else if (method === "send_tx") { sent.push(SignedTransaction.decode(Buffer.from(params.signed_tx_base64, "base64"))); result = { final_execution_status: "INCLUDED" }; }
    else throw new Error(`Unexpected RPC ${method}`);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }));
  const client = new AgentTrustClient({ network: "near:testnet", coreAccount: core, rpcUrl: "https://rpc.example" });
  return { client, owner: new AgentTrustOwner(client, owner, new KeyPairSigner(KeyPair.fromRandom("ed25519"))), sent };
}
afterEach(() => vi.unstubAllGlobals());
describe("separate owner helpers", () => {
  it("management attaches exactly one yocto and has no worker signing surface", async () => {
    const { client, owner, sent } = setup();
    const args = { expected_revision: 4, daily_cap_yocto: "500", max_dispatches_per_minute: 5, paused: false };
    await owner.setPolicy(args);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.transaction.receiverId).toBe(core);
    expect(sent[0]!.transaction.actions[0]!.functionCall!.deposit).toBe(1n);
    expect(sent[0]!.transaction.actions[0]!.functionCall!.methodName).toBe("set_policy");
    expect(JSON.parse(Buffer.from(sent[0]!.transaction.actions[0]!.functionCall!.args).toString())).toEqual(args);
    expect("setPolicy" in client).toBe(false); expect("installWorkerKey" in client).toBe(false);
  });
  it("funding explicitly splits credit and refuses impossible split before send", async () => {
    const { owner, sent } = setup();
    await expect(owner.deposit("10", "11")).rejects.toThrow("INVALID_DEPOSIT");
    expect(sent).toHaveLength(0);
    await owner.deposit("100", "20");
    expect(sent[0]!.transaction.actions[0]!.functionCall!.deposit).toBe(100n);
    expect(JSON.parse(Buffer.from(sent[0]!.transaction.actions[0]!.functionCall!.args).toString())).toEqual({ storage_credit_yocto: "20" });
  });
  it("key installation targets the owner with exact core/method/finite allowance", async () => {
    const { owner: helper, sent } = setup();
    const key = KeyPair.fromRandom("ed25519").getPublicKey().toString();
    await expect(helper.installWorkerKey(key, "0")).rejects.toThrow("INVALID_ALLOWANCE");
    await helper.installWorkerKey(key, "50000000000000000000000");
    expect(sent).toHaveLength(1); expect(sent[0]!.transaction.receiverId).toBe(owner);
    const access = sent[0]!.transaction.actions[0]!.addKey!.accessKey.permission.functionCall!;
    expect(access.receiverId).toBe(core); expect(access.methodNames).toEqual(["execute_payment"]);
    expect(access.allowance).toBe(50000000000000000000000n);
  });
  it("a restricted worker key cannot be used for owner operations", async () => {
    const { owner, sent } = setup({ FunctionCall: { receiver_id: core, method_names: ["execute_payment"], allowance: "1" } });
    await expect(owner.setPolicy({ expected_revision: 1, daily_cap_yocto: "1", max_dispatches_per_minute: 1, paused: true })).rejects.toThrow("OWNER_FULL_ACCESS_KEY_REQUIRED");
    expect(sent).toHaveLength(0);
  });
});
