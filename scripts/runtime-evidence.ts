import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const runtimeCasesV1 = ['initialization_authority','restricted_key','actual_signer','signed_dispatch','replay_conflict','concurrent_cap','failed_transfer','private_callback','withdrawal','callback_failure','refund_gap','midnight_and_edits'] as const;
export const requiredRuntimeCases = [...runtimeCasesV1,
  'session_and_profile_changes','exact_limits_and_preview','fixed_minute_rate',
  'trust_and_identity_changes','credential_changes','actor_capacity_and_storage',
  'relay_predecessor','transfer_capacity','withdrawal_failure',
] as const;
export const currentRuntimeSchemaVersion = 2;
type RecordValue = Record<string, unknown>;
function object(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
  return value as RecordValue;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected array`);
  return value;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.length) throw new Error(`${label}: expected text`);
  return value;
}
function ensure(condition: unknown, error: string): asserts condition { if (!condition) throw new Error(error); }
function noSecrets(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(noSecrets); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    ensure(!/^(secret_key|private_key|mnemonic|seed_phrase|auth_token|password|authorization)$/i.test(key), `secret-bearing field rejected: ${key}`);
    noSecrets(item);
  }
}
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function readJson(file:string, limit:number):Promise<unknown> {
  ensure((await stat(file)).size<=limit,'evidence file exceeds size bound');
  return JSON.parse(await readFile(file,'utf8')) as unknown;
}
function validateFinalTransaction(raw: unknown): void {
  const result=object(object(raw,'RPC envelope').result,'RPC result');
  ensure(result.final_execution_status==='FINAL','transaction evidence must explicitly reach FINAL');
  const transaction=object(result.transaction,'transaction');
  const hash=text(transaction.hash,'transaction hash');text(transaction.signer_id,'transaction signer');
  const outcome=object(result.transaction_outcome,'transaction outcome');
  ensure(outcome.id===hash,'transaction outcome ID does not match transaction hash');
  const status=object(result.status,'transaction final status');
  ensure('SuccessValue' in status || 'Failure' in status,'transaction final status is not terminal');
  const ids=new Set<string>([hash]);
  for (const entry of array(result.receipts_outcome,'receipt outcomes')) {
    const receipt=object(entry,'receipt');const id=text(receipt.id,'receipt ID');
    ensure(!ids.has(id),'duplicate receipt ID');ids.add(id);
    const details=object(receipt.outcome,'receipt outcome');text(details.executor_id,'receipt executor');
    const status=object(details.status,'receipt status');
    ensure('SuccessValue' in status || 'SuccessReceiptId' in status || 'Failure' in status,'receipt status not terminal');
  }
}
export async function checkRuntimeEvidence(manifestPath: string): Promise<{status:string; capture_status:string; schema_version:number; current_matrix_covered:boolean; missing_required_cases:string[]; captured_at:string; evidence_kind:'recorded_capture'; all_cases_reported_passed:boolean; artifact_count:number; limitations:string[]}> {
  const manifestFile=await realpath(manifestPath);const directory=path.dirname(manifestFile);
  const manifest=object(await readJson(manifestFile,4*1024*1024),'manifest');noSecrets(manifest);
  ensure((manifest.schema_version===1 || manifest.schema_version===currentRuntimeSchemaVersion) && manifest.kind==='agenttrust_native_runtime','unknown runtime manifest schema');
  const schemaVersion = manifest.schema_version as number;
  const capture=text(manifest.captured_at,'capture time');ensure(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(capture)&&Number.isFinite(Date.parse(capture)),'capture time must be UTC');
  ensure(/^[a-f0-9]{40}$/.test(text(manifest.git_commit,'git commit')),'invalid git commit');
  ensure(typeof manifest.working_tree_dirty==='boolean','working tree state missing');
  const environment=object(manifest.environment,'environment');ensure(environment.kind==='sandbox'&&environment.protocol_network==='near:testnet','expected sandbox environment and distinct protocol network');
  const rpc=new URL(text(environment.rpc_url,'RPC URL'));ensure(['127.0.0.1','[::1]','localhost'].includes(rpc.hostname),'Sandbox RPC must be loopback');
  text(manifest.command,'executed command');object(manifest.toolchain,'toolchain');
  for(const field of ['production_wasm_sha256','sandbox_binary_sha256']) ensure(/^[a-f0-9]{64}$/.test(text(manifest[field],field)),`invalid ${field}`);
  const artifactIndex=new Map<string,{sha256:string;kind:string}>();
  for (const entry of array(manifest.artifacts,'artifacts')) {
    const ref=object(entry,'artifact');const relative=text(ref.path,'artifact path');const sha=text(ref.sha256,'artifact hash');const kind=text(ref.kind,'artifact kind');
    ensure(['final_transaction','final_view','final_account','final_access_key','rpc_rejection','node_status','execution_block','receipt_payload'].includes(kind),'unknown artifact kind');
    ensure(/^[a-f0-9]{64}$/.test(sha),'invalid artifact hash');
    ensure(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..')&&relative.startsWith('raw/')&&!relative.includes('\\'),'unsafe artifact path');
    ensure(!artifactIndex.has(relative),'duplicate artifact path');
    const target=await realpath(path.join(directory,relative));ensure(target.startsWith(directory+path.sep),'artifact path escapes capture directory');
    ensure((await stat(target)).size<=64*1024*1024,'artifact exceeds size bound');const bytes=await readFile(target);
    ensure(digest(bytes)===sha,`artifact hash mismatch: ${relative}`);
    const raw:unknown=JSON.parse(bytes.toString('utf8'));noSecrets(raw);
    if(kind==='final_transaction') validateFinalTransaction(raw);
    if(kind==='receipt_payload') {
      const capture=object(raw,'receipt payload capture');text(capture.transaction_hash,'receipt transaction hash');
      const request=object(capture.request,'receipt request');const receiptId=text(request.receipt_id,'requested receipt ID');
      const response=object(capture.response,'receipt response');ensure(!('error' in response),'receipt payload query returned an error');
      const receipt=object(response.result,'receipt result');ensure(receipt.receipt_id===receiptId,'receipt payload ID does not match request');
      text(receipt.predecessor_id,'receipt predecessor');text(receipt.receiver_id,'receipt receiver');object(receipt.receipt,'receipt body');
    }
    if(kind==='execution_block') {
      const capture=object(raw,'execution block capture');text(capture.transaction_hash,'block transaction hash');text(capture.receipt_id,'block receipt ID');
      const request=object(capture.request,'block request');const blockHash=text(request.block_id,'requested block hash');
      const response=object(capture.response,'block response');ensure(!('error' in response),'execution block query returned an error');
      const header=object(object(response.result,'block result').header,'block header');
      ensure(header.hash===blockHash,'execution block hash does not match request');
      ensure(typeof header.height==='number'&&Number.isSafeInteger(header.height)&&header.height>=0,'execution block height missing');
      const timestamp=text(header.timestamp_nanosec,'execution block timestamp');
      ensure(/^(0|[1-9][0-9]*)$/.test(timestamp)&&BigInt(timestamp)<=18_446_744_073_709_551_615n,'invalid execution block timestamp');
    }
    if(['final_view','final_account','final_access_key'].includes(kind)) {
      const capture=object(raw,'query capture');const request=object(capture.request,'query request');const response=object(capture.response,'query response');
      ensure(request.finality==='final','view capture must include explicit final query request');
      ensure(!('error' in response),'final query returned an error');const result=object(response.result,'query result');text(result.block_hash,'query block hash');ensure(typeof result.block_height==='number'&&Number.isSafeInteger(result.block_height),'query block height missing');
    }
    artifactIndex.set(relative,{sha256:sha,kind});
  }
  const cases=object(manifest.cases,'cases');
  for(const required of schemaVersion===1 ? runtimeCasesV1 : requiredRuntimeCases) ensure(required in cases,`missing required case: ${required}`);
  const statuses:string[]=[];
  for(const [name,value] of Object.entries(cases)) {
    const c=object(value,`case ${name}`);const status=text(c.status,'case status');
    ensure(['passed','failed','not_run','user_run_required','unavailable','recorded_replay'].includes(status),'invalid case status');statuses.push(status);
    const assertions=array(c.assertions,'case assertions');const refs=array(c.artifacts,'case artifacts');array(c.limitations,'case limitations');
    for(const reference of refs) {const ref=object(reference,'case artifact');const indexed=artifactIndex.get(text(ref.path,'case artifact path'));ensure(indexed&&indexed.sha256===ref.sha256&&indexed.kind===ref.kind,'case artifact reference is not indexed');}
    if(status==='passed') {
      ensure(assertions.length>0,'passed case has no assertions');ensure(refs.length>0,'passed case has no supporting artifact');
      for(const value of assertions) {const a=object(value,'assertion');text(a.name,'assertion name');ensure(a.passed===true,'passed case contains false or missing assertion');}
    }
  }
  if(object(cases.callback_failure,'callback failure').status==='passed' || (cases.transfer_capacity!==undefined && object(cases.transfer_capacity,'transfer capacity').status==='passed')) ensure(typeof manifest.fault_wasm_sha256==='string'&&/^[a-f0-9]{64}$/.test(manifest.fault_wasm_sha256)&&manifest.fault_wasm_sha256!==manifest.production_wasm_sha256,'callback fault evidence requires a distinct fault artifact hash');
  if(['relay_predecessor','withdrawal_failure'].some(name=>cases[name]!==undefined && object(cases[name],name).status==='passed')) {
    ensure(typeof manifest.helper_wasm_sha256==='string'&&/^[a-f0-9]{64}$/.test(manifest.helper_wasm_sha256)&&manifest.helper_wasm_sha256!==manifest.production_wasm_sha256&&manifest.helper_wasm_sha256!==manifest.fault_wasm_sha256,'helper cases require a distinct runtime helper artifact hash');
  }
  const expected=manifest.fatal_error!==undefined||statuses.includes('failed')?'failed':statuses.every(s=>s==='passed')?'passed':'incomplete';
  ensure(manifest.status===expected,'aggregate status does not match cases; incomplete cases cannot claim passed');
  ensure(manifest.exit_status===(expected==='passed'?0:expected==='failed'?1:2),'exit status does not match capture result');
  const missingRequiredCases = requiredRuntimeCases.filter(name=>!(name in cases));
  const currentMatrixCovered = schemaVersion === currentRuntimeSchemaVersion && missingRequiredCases.length === 0;
  const status = expected==='passed' && !currentMatrixCovered ? 'incomplete' : expected;
  return {status,capture_status:expected,schema_version:schemaVersion,current_matrix_covered:currentMatrixCovered,missing_required_cases:missingRequiredCases,captured_at:capture,evidence_kind:'recorded_capture',all_cases_reported_passed:status==='passed',artifact_count:artifactIndex.size,limitations:['Structure and artifact integrity checked read-only; assertion truth still requires review of the referenced public RPC evidence.','This is a dated recorded capture, not a fresh live execution or a light-client proof.',...(!currentMatrixCovered ? ['Historical schema capture does not satisfy the current runtime matrix; retain its original result without upgrading coverage.'] : [])]};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/runtime-evidence.ts <manifest.json>');
    const result = await checkRuntimeEvidence(process.argv[2]!);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.all_cases_reported_passed ? 0 : 2;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
