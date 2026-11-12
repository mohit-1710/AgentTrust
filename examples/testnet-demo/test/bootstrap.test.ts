import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Account, JsonRpcProvider, KeyPairSigner, PublicKey, baseDecode, baseEncode } from "near-api-js";
import { AccountDoesNotExistError } from "near-api-js/rpc-errors";
import { afterEach, expect, it, vi } from "vitest";
import { bootstrapArguments, bootstrapRoles, inspectProductionWasm, loadBootstrapBundle, prepareBootstrap, runBootstrap, runBootstrapStep, type BootstrapBundle } from "../src/bootstrap.js";
import { renderPublicConfigs, sha256 } from "../src/config.js";
const directories: string[] = [];
const NEAR = 10n ** 24n;
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
const imports = "current_account_id predecessor_account_id signer_account_id signer_account_pk attached_deposit account_balance storage_usage read_register value_return storage_read storage_write ed25519_verify promise_batch_create promise_batch_action_transfer promise_results_count promise_result promise_batch_then promise_batch_action_function_call".split(" ");
const exports = "new deposit get_account set_policy set_profile register_session revoke_session get_config get_policy get_session set_service issue_credential revoke_credential get_service get_credential set_service_trust block_service block_payout execute_payment get_payment on_payment_result withdraw_available on_withdrawal_result get_withdrawal get_profile list_services list_recent_payments preview_payment".split(" ");
const leb = (n: number): number[] => n >= 128 ? [(n & 127) | 128, ...leb(n >>> 7)] : [n];
const str = (value: string) => [...leb(Buffer.byteLength(value)), ...Buffer.from(value)];
const section = (id: number, contents: number[]) => [id, ...leb(contents.length), ...contents];
function wasm(marker = "", omit = "") {
  const exportsToUse = exports.filter((name) => name !== omit);
  return Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, ...section(1, [1, 96, 0, 0]), ...section(2, [...leb(imports.length), ...imports.flatMap((name) => [...str("env"), ...str(name), 0, 0])]), ...section(7, [...leb(exportsToUse.length), ...exportsToUse.flatMap((name) => [...str(name), 0, 0])]), ...(marker ? section(0, str(marker)) : [])]);
}
async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "agenttrust-bootstrap-test-")); directories.push(root);
  const artifact = path.join(root, "target/wasm32-unknown-unknown/release/agenttrust_core.wasm");
  await mkdir(path.dirname(artifact), { recursive: true }); await writeFile(artifact, wasm());
  return { root, artifact, directory: path.join(root, "private-demo") };
}
async function prepared() { const f = await fixture(); return { ...f, bundle: await prepareBootstrap(f.directory, f.root) }; }
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const replace = async (file: string, value: unknown) => writeFile(file, JSON.stringify(value), { mode: 0o600 });
const state = (amount = 10n * NEAR) => ({ amount, locked: 0n, code_hash: baseEncode(Buffer.alloc(32)), storage_usage: 182, block_height: 99, block_hash: baseEncode(Buffer.alloc(32, 4)) });
function rpc(bundle: BootstrapBundle) {
  const accounts = new Map<string, ReturnType<typeof state>>(), transactions = new Map<string, unknown>();
  const viewAccount = vi.spyOn(JsonRpcProvider.prototype, "viewAccount").mockImplementation(async ({ accountId, blockQuery }) => {
    expect(blockQuery).toEqual({ finality: "final" });
    if (!accounts.has(accountId)) throw new AccountDoesNotExistError(accountId, baseEncode(Buffer.alloc(32, 4)), 99);
    return accounts.get(accountId)!;
  });
  const access = vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockImplementation(async ({ accountId, publicKey, finalityQuery }) => {
    expect(finalityQuery).toEqual({ finality: "final" });
    const expected = Object.values(bundle.keys).find((key) => key.role !== "worker" && key.account_id === accountId)!;
    expect(publicKey.toString()).toBe(expected.public_key);
    return { nonce: 0n, permission: "FullAccess", block_height: 99, block_hash: baseEncode(Buffer.alloc(32, 4)) };
  });
  const json = vi.spyOn(JsonRpcProvider.prototype, "sendJsonRpc").mockImplementation(async (method, params) => {
    if (method === "status") return { chain_id: "testnet" } as never;
    expect(method).toBe("EXPERIMENTAL_tx_status");
    const p = params as { tx_hash: string; wait_until: string; sender_account_id: string };
    expect(p.wait_until).toBe("FINAL"); expect(p.sender_account_id).toBe(bundle.manifest.parent_id);
    if (!transactions.has(p.tx_hash)) throw new Error("MOCK_UNKNOWN_TRANSACTION");
    return transactions.get(p.tx_hash) as never;
  });
  const protocol = vi.spyOn(JsonRpcProvider.prototype, "experimental_protocolConfig").mockImplementation(async (query) => { expect(query).toEqual({ finality: "final" }); return { runtime_config: { storage_amount_per_byte: "10000000000000000000" } } as never; });
  const broadcast = vi.spyOn(JsonRpcProvider.prototype, "sendTransactionUntil").mockRejectedValue(new Error("MOCK_LOST_RESPONSE"));
  const create = vi.spyOn(Account.prototype, "createTransaction").mockResolvedValue({} as never);
  let sequence = 10;
  const sign = vi.fn(async () => ({ txHash: Buffer.alloc(32, sequence++), signedTransaction: {} }));
  const signer = vi.spyOn(KeyPairSigner, "fromSecretKey").mockImplementation(() => ({ signTransaction: sign }) as never);
  const fetcher = vi.fn(async (_url: unknown, request: RequestInit | undefined) => {
    expect(request?.method).toBe("POST");
    accounts.set(bundle.manifest.parent_id, state());
    return new Response("untrusted body never persisted", { status: 200 });
  }); vi.stubGlobal("fetch", fetcher);
  return { accounts, transactions, viewAccount, access, json, protocol, broadcast, create, sign, signer, fetcher };
}
async function recordChild(bundle: BootstrapBundle, role: string, m: ReturnType<typeof rpc>) {
  const claim = await read(path.join(bundle.directory, "operations", `create-${role}.json`));
  const raw = { final_execution_status: "FINAL", transaction: { hash: claim.transaction.tx_hash, signer_id: claim.parent_id, public_key: claim.parent_public_key, receiver_id: claim.receiver_id, actions: ["CreateAccount", { Transfer: { deposit: claim.amount_yocto } }, { AddKey: { public_key: claim.receiver_public_key, access_key: { nonce: 0, permission: "FullAccess" } } }] }, transaction_outcome: { id: claim.transaction.tx_hash }, receipts_outcome: [], status: { SuccessValue: "" } };
  m.transactions.set(claim.transaction.tx_hash, raw);
  m.accounts.set(claim.receiver_id, state(BigInt(claim.amount_yocto)));
  m.accounts.get(claim.parent_id)!.amount -= BigInt(claim.amount_yocto) + NEAR / 1_000n;
  return { claim, raw };
}
it("requires exact explicit prepare or user-run arguments and fixed steps", () => {
  expect(bootstrapArguments(["--prepare", "--directory", "/prepared"])).toEqual({ directory: "/prepared", step: "prepare" });
  expect(bootstrapArguments(["--user-run", "--directory", "/prepared", "--step", "observe-create-provider-b"])).toEqual({ directory: "/prepared", step: "observe-create-provider-b" });
  for (const args of [[], ["--prepare", "--directory", "relative"], ["--prepare", "--directory", "/tmp/../demo"], ["--user-run", "--directory", "/demo", "--step", "transfer"], ["--directory", "/demo", "--step", "faucet"], ["--prepare", "--directory", "/demo", "--execute"], ["--user-run", "--directory", "/demo", "--step", "faucet", "--rpc", "https://other"]]) expect(() => bootstrapArguments(args)).toThrow();
});
it("inspects production imports/exports and rejects both instrumented artifact kinds", () => {
  expect(inspectProductionWasm(wasm())).toBe(sha256(wasm()));
  for (const bytes of [wasm("RUNTIME_TEST_CALLBACK_FAILURE"), wasm("AGENTTRUST_RUNTIME_HELPER_ONLY"), wasm("", "execute_payment"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])]) expect(() => inspectProductionWasm(bytes)).toThrow();
});
it("prepares independent bound keys/configs privately with no network, signer or stdout", async () => {
  const f = await fixture(), fetcher = vi.fn(() => { throw new Error("NO_NETWORK"); }); vi.stubGlobal("fetch", fetcher);
  const signer = vi.spyOn(KeyPairSigner, "fromSecretKey").mockImplementation(() => { throw new Error("NO_SIGNER"); });
  const network = vi.spyOn(JsonRpcProvider.prototype, "sendJsonRpc").mockImplementation(() => { throw new Error("NO_RPC"); });
  const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
  const b = await prepareBootstrap(f.directory, f.root);
  expect(fetcher).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled(); expect(signer).not.toHaveBeenCalled(); expect(stdout).not.toHaveBeenCalled();
  expect(b.manifest.parent_id).toMatch(/^agenttrust-[a-f0-9]{24}\.testnet$/);
  expect(b.demo.providers.a.service_id).toBe(`service-a.${b.manifest.parent_id}`);
  expect(b.demo.providers.b.payout_account).toBe(b.demo.providers.b.service_id);
  expect(b.demo.rotated_payout_account).toBe(b.manifest.parent_id);
  expect(b.keys.worker.account_id).toBe(b.demo.owner_id);
  expect(b.demo.expected_wasm_sha256).toBe(sha256(wasm()));
  const configs = renderPublicConfigs(b.demo);
  expect(await read(path.join(f.directory, "mcp.json"))).toEqual(configs.mcp);
  expect(await read(path.join(f.directory, "provider-a.json"))).toEqual(configs.provider_a);
  for (const dir of [f.directory, ...["secrets", "operations", "evidence"].map((d) => path.join(f.directory, d))]) expect((await lstat(dir)).mode & 0o777).toBe(0o700);
  const publicFiles = ["demo.json", "bootstrap.json", "provider-a.json", "provider-b.json", "mcp.json", ...(await readdir(path.join(f.directory, "evidence"))).map((name) => `evidence/${name}`)];
  for (const name of [...publicFiles, ...(await readdir(path.join(f.directory, "secrets"))).map((n) => `secrets/${n}`)]) expect((await lstat(path.join(f.directory, name))).mode & 0o777).toBe(0o600);
  const published = (await Promise.all(publicFiles.map((name) => readFile(path.join(f.directory, name), "utf8")))).join("\n");
  for (const key of Object.values(b.keys)) expect(published).not.toContain(key.private_key);
  for (const key of Object.values(b.invoices)) expect(published).not.toContain(key.seed_base64);
  expect(new Set([b.demo.session_id, b.demo.credential_id, ...Object.values(b.demo.payment_ids)]).size).toBe(6);
  expect(await loadBootstrapBundle(f.directory, f.root)).toEqual(b);
});
it("never replaces an existing bundle or follows a symlink; concurrent preparations have one winner", async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled([prepareBootstrap(f.directory, f.root), prepareBootstrap(f.directory, f.root)]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const before = await readFile(path.join(f.directory, "secrets/parent.json"));
  await expect(prepareBootstrap(f.directory, f.root)).rejects.toThrow();
  expect(await readFile(path.join(f.directory, "secrets/parent.json"))).toEqual(before);
  const link = path.join(f.root, "link"); await symlink(f.directory, link);
  await expect(prepareBootstrap(link, f.root)).rejects.toThrow(); await expect(loadBootstrapBundle(link, f.root)).rejects.toThrow();
});
it("rejects corrupt secret seeds while the encoded public suffix and manifest remain unchanged", async () => {
  const f = await prepared(), file = path.join(f.directory, "secrets/parent.json"), key = await read(file);
  const bytes = baseDecode(key.private_key.slice(8)); bytes[0] = bytes[0]! ^ 1; key.private_key = `ed25519:${baseEncode(bytes)}`; await replace(file, key);
  await expect(loadBootstrapBundle(f.directory, f.root)).rejects.toThrow(/BOOTSTRAP_(KEY|SECRET_SEED)_MISMATCH/);
});
it.each(["manifest-domain", "invoice", "key-role", "mcp", "provider", "wasm", "permissions", "symlink"])("refuses %s bundle drift before any operation", async (kind) => {
  const f = await prepared(), m = rpc(f.bundle);
  if (kind === "manifest-domain") { const v = await read(path.join(f.directory, "bootstrap.json")); v.rpc_url = "https://rpc.mainnet.near.org"; await replace(path.join(f.directory, "bootstrap.json"), v); }
  if (kind === "invoice") { const file = path.join(f.directory, "secrets/provider-a-invoice.json"), v = await read(file); v.seed_base64 = Buffer.alloc(32, 2).toString("base64"); await replace(file, v); }
  if (kind === "key-role") { const file = path.join(f.directory, "secrets/worker.json"), v = await read(file); v.account_id = "unrelated.testnet"; await replace(file, v); }
  if (kind === "mcp") { const file = path.join(f.directory, "mcp.json"), v = await read(file); v.owner_id = "unrelated.testnet"; await replace(file, v); }
  if (kind === "provider") { const file = path.join(f.directory, "provider-a.json"), v = await read(file); v.offer.service.invoice_key = Buffer.alloc(32).toString("base64"); await replace(file, v); }
  if (kind === "wasm") await writeFile(f.artifact, wasm("AGENTTRUST_RUNTIME_HELPER_ONLY"));
  if (kind === "permissions") await chmod(path.join(f.directory, "secrets/parent.json"), 0o644);
  if (kind === "symlink") { const file = path.join(f.directory, "mcp.json"); await rm(file); await symlink(path.join(f.directory, "demo.json"), file); }
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow();
  expect(m.json).not.toHaveBeenCalled(); expect(m.fetcher).not.toHaveBeenCalled(); expect(m.signer).not.toHaveBeenCalled();
});
it("permits only TLS path edits in generated provider configs", async () => {
  const f = await prepared(), file = path.join(f.directory, "provider-a.json"), v = await read(file);
  v.tls = { cert_file: "/private/cert.pem", key_file: "/private/key.pem" }; await replace(file, v);
  expect((await loadBootstrapBundle(f.directory, f.root)).demo).toEqual(f.bundle.demo);
});
it("stops on a non-testnet RPC or uncertain absence before any funding", async () => {
  const f = await prepared(), m = rpc(f.bundle);
  m.json.mockResolvedValueOnce({ chain_id: "mainnet" } as never);
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow("TESTNET_REQUIRED");
  m.viewAccount.mockRejectedValueOnce(new Error("NETWORK_FAILED_WITH_SECRET"));
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow();
  m.viewAccount.mockRejectedValueOnce(new AccountDoesNotExistError("other.testnet", "block", 1));
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow();
  expect(await readdir(path.join(f.directory, "operations"))).toEqual([]); expect(m.fetcher).not.toHaveBeenCalled();
});
it("refuses a preexisting parent rather than adopting or funding it", async () => {
  const f = await prepared(), m = rpc(f.bundle); m.accounts.set(f.bundle.manifest.parent_id, state());
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow("ACCOUNT_ALREADY_EXISTS_USE_OBSERVATION"); expect(m.fetcher).not.toHaveBeenCalled();
});
it("durably claims the exact faucet body before POST and preserves uncertainty across restart", async () => {
  const f = await prepared(), m = rpc(f.bundle);
  m.fetcher.mockImplementationOnce(async (url, request) => {
    expect(url).toBe("https://helper.nearprotocol.com/account");
    const claim = await read(path.join(f.directory, "operations/faucet.json"));
    expect(JSON.parse(request!.body as string)).toEqual(claim.request);
    expect(claim.request).toEqual({ newAccountId: f.bundle.manifest.parent_id, newAccountPublicKey: f.bundle.keys.parent.public_key });
    expect(request?.redirect).toBe("error"); expect(request?.signal).toBeInstanceOf(AbortSignal);
    throw new Error(`LOST_RESPONSE ${f.bundle.keys.parent.private_key}`);
  });
  const uncertain = await runBootstrapStep(f.directory, "faucet", f.root);
  expect(uncertain.status).toBe("uncertain"); expect(await readFile(uncertain.evidence_file, "utf8")).not.toContain(f.bundle.keys.parent.private_key);
  const before = await readFile(path.join(f.directory, "operations/faucet.json"));
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow("SAVED_CLAIM_USE_OBSERVE");
  expect((await runBootstrapStep(f.directory, "observe-faucet", f.root)).status).toBe("uncertain");
  m.accounts.set(f.bundle.manifest.parent_id, state());
  const observed = await runBootstrapStep(f.directory, "observe-faucet", f.root);
  expect(observed.status).toBe("observed"); expect((await read(observed.evidence_file)).result.provenance).toContain("not proven");
  expect(await readFile(path.join(f.directory, "operations/faucet.json"))).toEqual(before);
  expect(m.fetcher).toHaveBeenCalledTimes(1); expect(m.signer).not.toHaveBeenCalled(); expect(m.broadcast).not.toHaveBeenCalled();
});
it("allows only one POST when two faucet invocations race", async () => {
  const f = await prepared(), m = rpc(f.bundle);
  await Promise.allSettled([runBootstrapStep(f.directory, "faucet", f.root), runBootstrapStep(f.directory, "faucet", f.root)]);
  expect(m.fetcher).toHaveBeenCalledTimes(1);
});
it("will not observe an unsaved operation or accept a changed saved binding", async () => {
  const f = await prepared(), m = rpc(f.bundle);
  await expect(runBootstrapStep(f.directory, "observe-faucet", f.root)).rejects.toThrow("SAVED_CLAIM_REQUIRED");
  await runBootstrapStep(f.directory, "faucet", f.root);
  const file = path.join(f.directory, "operations/faucet.json"), v = await read(file); v.request.newAccountId = "other.testnet"; await replace(file, v);
  await expect(runBootstrapStep(f.directory, "observe-faucet", f.root)).rejects.toThrow("BOOTSTRAP_CLAIM_MISMATCH"); expect(m.fetcher).toHaveBeenCalledTimes(1);
});
it.each(["low-gross", "storage-budget", "locked", "code", "child-collision", "restricted-parent"])("refuses %s before child signing or claiming", async (kind) => {
  const f = await prepared(), m = rpc(f.bundle); await runBootstrapStep(f.directory, "faucet", f.root);
  const parent = m.accounts.get(f.bundle.manifest.parent_id)!;
  if (kind === "low-gross") parent.amount = 99n * NEAR / 10n;
  if (kind === "storage-budget") parent.storage_usage = 60_000;
  if (kind === "locked") parent.locked = 1n;
  if (kind === "code") parent.code_hash = baseEncode(Buffer.alloc(32, 9));
  if (kind === "child-collision") m.accounts.set(f.bundle.demo.providers.b.service_id, state());
  if (kind === "restricted-parent") m.access.mockResolvedValueOnce({ permission: { FunctionCall: { allowance: "1", receiver_id: "other.testnet", method_names: [] } } } as never);
  await expect(runBootstrapStep(f.directory, "create-core", f.root)).rejects.toThrow();
  expect(await readdir(path.join(f.directory, "operations"))).toEqual(["faucet.json"]); expect(m.signer).not.toHaveBeenCalled(); expect(m.broadcast).not.toHaveBeenCalled();
});
it("allows gross10 with storage, journals before one FINAL send, and cannot resend after lost response", async () => {
  const f = await prepared(), m = rpc(f.bundle); await runBootstrapStep(f.directory, "faucet", f.root);
  m.broadcast.mockImplementationOnce(async (_signed, finality) => {
    expect(finality).toBe("FINAL");
    const claim = await read(path.join(f.directory, "operations/create-core.json"));
    expect(claim.transaction.tx_hash).toBe(baseEncode(Buffer.alloc(32, 10)));
    throw new Error("LOST_RESPONSE");
  });
  expect((await runBootstrapStep(f.directory, "create-core", f.root)).status).toBe("uncertain");
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ receiverId: f.bundle.demo.core_account, publicKey: PublicKey.from(f.bundle.keys.parent.public_key) }));
  const actualActions = m.create.mock.calls[0]![0].actions;
  expect(actualActions.map((a) => a.enum)).toEqual(["createAccount", "transfer", "addKey"]);
  expect(actualActions[1]!.transfer!.deposit).toBe(6n * NEAR);
  expect(actualActions[2]!.addKey!.publicKey.toString()).toBe(f.bundle.keys.core.public_key);
  await expect(runBootstrapStep(f.directory, "create-core", f.root)).rejects.toThrow("SAVED_CLAIM_USE_OBSERVE");
  expect((await runBootstrapStep(f.directory, "observe-create-core", f.root)).status).toBe("uncertain");
  await recordChild(f.bundle, "core", m);
  expect((await runBootstrapStep(f.directory, "observe-create-core", f.root)).status).toBe("observed");
  expect(m.broadcast).toHaveBeenCalledTimes(1); expect(m.signer).toHaveBeenCalledTimes(1); expect(m.sign).toHaveBeenCalledTimes(1);
});
it("creates all five fixed children in order without incorrectly reapplying the10NEAR initial guard", async () => {
  const f = await prepared(), m = rpc(f.bundle); await runBootstrapStep(f.directory, "faucet", f.root);
  await expect(runBootstrapStep(f.directory, "create-owner", f.root)).rejects.toThrow("PREVIOUS_CHILD_CREATION_REQUIRED");
  for (const role of ["core", "owner", "issuer", "provider-a", "provider-b"]) {
    m.broadcast.mockImplementationOnce(async () => { await recordChild(f.bundle, role, m); return {} as never; });
    expect((await runBootstrapStep(f.directory, `create-${role}`, f.root)).status).toBe("created");
  }
  expect(m.accounts.get(f.bundle.manifest.parent_id)!.amount).toBe(495n * NEAR / 1000n);
  expect(m.broadcast).toHaveBeenCalledTimes(5); expect(m.fetcher).toHaveBeenCalledTimes(1);
  expect(m.create.mock.calls.map(([request]) => request.receiverId)).toEqual([f.bundle.demo.core_account, f.bundle.demo.owner_id, f.bundle.demo.issuer_id, f.bundle.demo.providers.a.service_id, f.bundle.demo.providers.b.service_id]);
});
it.each(["receiver", "signer-key", "amount", "child-key", "extra-action", "failed", "not-final"])("rejects %s final proof and never treats it as successful creation", async (kind) => {
  const f = await prepared(), m = rpc(f.bundle); await runBootstrapStep(f.directory, "faucet", f.root); await runBootstrapStep(f.directory, "create-core", f.root);
  const { raw } = await recordChild(f.bundle, "core", m);
  if (kind === "receiver") raw.transaction.receiver_id = "other.testnet";
  if (kind === "signer-key") raw.transaction.public_key = f.bundle.keys.owner.public_key;
  if (kind === "amount") (raw.transaction.actions[1] as { Transfer: { deposit: string } }).Transfer.deposit = "1";
  if (kind === "child-key") (raw.transaction.actions[2] as { AddKey: { public_key: string } }).AddKey.public_key = f.bundle.keys.owner.public_key;
  if (kind === "extra-action") raw.transaction.actions.push("DeleteAccount");
  if (kind === "failed") Object.assign(raw, { status: { Failure: { ActionError: "failure" } } });
  if (kind === "not-final") raw.final_execution_status = "EXECUTED_OPTIMISTIC";
  expect((await runBootstrapStep(f.directory, "observe-create-core", f.root)).status).toBe("uncertain");
  await expect(runBootstrapStep(f.directory, "create-owner", f.root)).rejects.toThrow();
  expect(m.broadcast).toHaveBeenCalledTimes(1); expect(m.signer).toHaveBeenCalledTimes(1);
});
it("help reads no bundle, emits no secret and contacts no network", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {}), network = vi.spyOn(JsonRpcProvider.prototype, "sendJsonRpc");
  await runBootstrap(["--help"]); expect(log.mock.calls[0]![0]).toContain("USER-RUN"); expect(network).not.toHaveBeenCalled();
});

it("refuses new provisioning after expiry but still loads and observes the original bundle", async () => {
  const f = await prepared(), m = rpc(f.bundle); await runBootstrapStep(f.directory, "faucet", f.root);
  vi.spyOn(Date, "now").mockReturnValue(Number(BigInt(f.bundle.demo.session_expires_at_ns) / 1_000_000n) + 1);
  await expect(runBootstrapStep(f.directory, "create-core", f.root)).rejects.toThrow("DEMO_EXPIRED_NO_NEW_PROVISIONING");
  expect((await loadBootstrapBundle(f.directory, f.root)).demo).toEqual(f.bundle.demo);
  expect((await runBootstrapStep(f.directory, "observe-faucet", f.root)).status).toBe("observed");
  expect(m.signer).not.toHaveBeenCalled(); expect(m.broadcast).not.toHaveBeenCalled(); expect(m.fetcher).toHaveBeenCalledTimes(1);
});
it("does not claim or POST for an offline bundle that has already expired", async () => {
  const f = await prepared(), m = rpc(f.bundle);
  vi.spyOn(Date, "now").mockReturnValue(Number(BigInt(f.bundle.demo.credential_expires_at_ns) / 1_000_000n) + 1);
  await expect(runBootstrapStep(f.directory, "faucet", f.root)).rejects.toThrow("DEMO_EXPIRED_NO_NEW_PROVISIONING");
  expect(await readdir(path.join(f.directory, "operations"))).toEqual([]); expect(m.json).not.toHaveBeenCalled(); expect(m.fetcher).not.toHaveBeenCalled();
});
