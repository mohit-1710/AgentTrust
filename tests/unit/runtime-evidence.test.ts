import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkRuntimeEvidence, requiredRuntimeCases } from '../../scripts/runtime-evidence.ts';
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true}))); });
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const tx=()=>({result:{final_execution_status:'FINAL',transaction:{hash:'tx',signer_id:'owner.test.near'},transaction_outcome:{id:'tx',outcome:{status:{SuccessReceiptId:'receipt'},receipt_ids:['receipt']}},receipts_outcome:[{id:'receipt',outcome:{executor_id:'core.test.near',status:{SuccessValue:''},receipt_ids:[],logs:[]}}],status:{SuccessValue:''}}});
async function capture() {
  const dir=await mkdtemp(path.join(tmpdir(),'agenttrust-evidence-'));dirs.push(dir);await mkdir(path.join(dir,'raw'));
  const raw=JSON.stringify(tx());await writeFile(path.join(dir,'raw/tx.json'),raw);
  const ref={path:'raw/tx.json',sha256:sha(raw),kind:'final_transaction'};
  const cases=Object.fromEntries(requiredRuntimeCases.map(name=>[name,{status:'passed',verification_ids:['V01'],assertions:[{name:'observed predicate',passed:true}],artifacts:[ref],limitations:[]} ]));
  const manifest:any={schema_version:1,kind:'agenttrust_native_runtime',status:'passed',captured_at:'2026-11-11T01:00:00Z',git_commit:'a'.repeat(40),working_tree_dirty:false,environment:{kind:'sandbox',protocol_network:'near:testnet',rpc_url:'http://127.0.0.1:1234',reported_chain_id:'sandbox',node_version:{version:'2.14.0'}},core_account:'core.test.near',toolchain:{rust:'1.97.1',near_workspaces:'0.24.0',near_sdk:'5.30.1'},production_wasm_sha256:'b'.repeat(64),fault_wasm_sha256:'c'.repeat(64),sandbox_binary_sha256:'d'.repeat(64),command:'pnpm verify:runtime -- --user-run --sandbox-bin /local/near-sandbox',exit_status:0,actors:[{role:'buyer',account_id:'owner.test.near',worker_public_key_sha256:'e'.repeat(64)}],artifacts:[ref],cases,limitations:['Synthetic checker fixture; not runtime evidence.']};
  const save=async()=>{await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));return path.join(dir,'manifest.json');};
  return {dir,manifest,save,ref};
}
describe('runtime evidence checker uses recorded evidence without running a chain',()=>{
  it('labels a structurally consistent capture as recorded, never a fresh live run',async()=>{const c=await capture();expect(await checkRuntimeEvidence(await c.save())).toMatchObject({status:'passed',evidence_kind:'recorded_capture',captured_at:c.manifest.captured_at,all_cases_reported_passed:true,artifact_count:1});});
  it('keeps unavailable proof incomplete rather than making its artifact pass the gate',async()=>{const c=await capture();c.manifest.status='incomplete';c.manifest.exit_status=2;c.manifest.cases.refund_gap={status:'unavailable',verification_ids:['V17'],assertions:[],artifacts:[],limitations:['No observed refund gap']};expect((await checkRuntimeEvidence(await c.save())).all_cases_reported_passed).toBe(false);});
  it.each(['not_run','user_run_required','unavailable','recorded_replay'])('rejects passed aggregate with %s case',async(status)=>{const c=await capture();c.manifest.cases.refund_gap.status=status;await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/status|passed/);});
  it('rejects omitted mandatory cases',async()=>{const c=await capture();delete c.manifest.cases.restricted_key;await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/missing|case/);});
  it('rejects a false assertion hidden inside a passed case',async()=>{const c=await capture();c.manifest.cases.signed_dispatch.assertions[0].passed=false;await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/assertion/);});
  it('rejects passed cases without supporting artifacts',async()=>{const c=await capture();c.manifest.cases.signed_dispatch.artifacts=[];await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/artifact/);});
  it('rejects altered raw evidence',async()=>{const c=await capture();await writeFile(path.join(c.dir,c.ref.path),'{}');await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/hash/);});
  it('rejects inclusion short of FINAL even when hashes match',async()=>{const c=await capture();const raw=tx();raw.result.final_execution_status='EXECUTED';const text=JSON.stringify(raw);await writeFile(path.join(c.dir,c.ref.path),text);c.ref.sha256=sha(text);await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/FINAL/);});
  it('rejects a transaction outcome misbound to another transaction ID',async()=>{const c=await capture();const raw=tx();raw.result.transaction_outcome.id='other';const text=JSON.stringify(raw);await writeFile(path.join(c.dir,c.ref.path),text);c.ref.sha256=sha(text);await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/transaction/);});
  it('rejects path traversal before reading outside the capture',async()=>{const c=await capture();c.ref.path='../outside.json';await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/path/);});
  it('rejects symlinks escaping the capture directory',async()=>{const c=await capture();const outside=await mkdtemp(path.join(tmpdir(),'agenttrust-outside-'));dirs.push(outside);await writeFile(path.join(outside,'raw.json'),JSON.stringify(tx()));await symlink(path.join(outside,'raw.json'),path.join(c.dir,'raw/link.json'));c.ref.path='raw/link.json';await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/path|escape/);});
  it('rejects an unindexed case artifact reference',async()=>{const c=await capture();c.manifest.cases.signed_dispatch.artifacts=[{...c.ref,path:'raw/unknown.json'}];await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/indexed|reference/);});
  it('rejects secret-bearing manifest keys',async()=>{const c=await capture();c.manifest.actors[0].secret_key='never-record-this';await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/secret/);});
  it('rejects treating local Sandbox capture as testnet execution',async()=>{const c=await capture();c.manifest.environment.kind='testnet';await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/sandbox/);});
  it('rejects missing or reused fault artifact hashes for a claimed injected case',async()=>{const c=await capture();c.manifest.fault_wasm_sha256=c.manifest.production_wasm_sha256;await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/fault/);});
  it('rejects passed status when recorded command failed',async()=>{const c=await capture();c.manifest.exit_status=1;await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/exit/);});
});

describe('final view evidence includes the request and response',()=>{
  it('accepts an explicitly final recorded view alongside transaction evidence',async()=>{const c=await capture();const raw=JSON.stringify({request:{request_type:'call_function',finality:'final'},response:{result:{block_hash:'block',block_height:12,result:[]}}});await writeFile(path.join(c.dir,'raw/view.json'),raw);c.manifest.artifacts.push({path:'raw/view.json',sha256:sha(raw),kind:'final_view'});expect((await checkRuntimeEvidence(await c.save())).artifact_count).toBe(2);});
  it('rejects relabeling an optimistic query as a final view',async()=>{const c=await capture();const raw=JSON.stringify({request:{request_type:'call_function',finality:'optimistic'},response:{result:{block_hash:'block',block_height:12,result:[]}}});await writeFile(path.join(c.dir,'raw/view.json'),raw);c.manifest.artifacts.push({path:'raw/view.json',sha256:sha(raw),kind:'final_view'});await expect(checkRuntimeEvidence(await c.save())).rejects.toThrow(/final query/);});
});
