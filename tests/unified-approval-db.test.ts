import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {jakartaDate} from '../src/domain/workflow';
const db=new PGlite();const a=(n:number)=>`a0000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const rows=async(s:string,p:any[]=[]) =>(await db.query<any>(s,p)).rows;
const letter=async(id:string)=>(await rows('select * from letters where id=$1',[id]))[0];
let waiting:string,revising:string,legacy:string,oldLegacy:any,oldVersion:any,oldComments:any;
async function save(actor=5,extra:any={}){const p={source:'CREATE',letterTypeCode:'IN',categoryCode:'LAPORAN',subject:'Unified fixture',letterDate:jakartaDate(),recipientUserId:a(4),recipientName:'External',recipientOrg:'Company',recipientAddress:'Address',content:'Document body',signatureMode:'IN_APP',signerIds:[],areas:[],...extra};return(await rows('select save_letter_draft($1,$2::jsonb,$3::jsonb) id',[a(actor),JSON.stringify(p),JSON.stringify({path:a(actor)+'/fixture.docx',hash:extra.hash||'content-hash',format:'DOCX'})]))[0].id;}
async function submit(id:string,n=5){const l=await letter(id);await rows("select review_letter($1,$2,'PREVIEW',$3,null)",[a(n),id,l.revision]);return rows('select submit_letter_for_approval($1,$2,$3,false)',[a(n),id,l.revision]);}
async function decide(id:string,n:number,action:string,note:string|null=null,revision?:number){return rows('select review_letter($1,$2,$3,$4,$5)',[a(n),id,action,revision??(await letter(id)).revision,note]);}
async function asUser(n:number,s:string,p:any[]=[]){await db.exec('begin');try{await rows("select set_config('request.jwt.claim.sub',$1,true)",[a(n)]);await db.exec('set local role authenticated');return await rows(s,p);}finally{await db.exec('rollback');}}
beforeAll(async()=>{
 await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql','utf8'));await db.exec(readFileSync('supabase/tests/00_stub_storage.sql','utf8'));
 const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();const unified=migrations.find(f=>f.endsWith('_unified_content_approval.sql'))!;
 for(const f of migrations.filter(f=>f<unified))await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(readFileSync('supabase/seed.sql','utf8'));await db.exec(readFileSync('supabase/tests/00_workflow_fixtures.sql','utf8'));
 waiting=await save(5,{reviewRequested:true,reviewerId:a(3)});await submit(waiting);
 let step=(await rows('select * from review_steps where letter_id=$1',[waiting]))[0];await rows("select decide_letter_review($1,$2,$3,$4,'COMMENT','Historical note')",[a(3),step.id,step.version_id,(await letter(waiting)).revision]);
 oldComments=await rows('select * from review_comments where step_id=$1',[step.id]);oldVersion=await rows('select * from letter_versions where letter_id=$1',[waiting]);
 revising=await save(5,{reviewRequested:true,reviewerId:a(3)});await submit(revising);step=(await rows('select * from review_steps where letter_id=$1',[revising]))[0];await rows("select decide_letter_review($1,$2,$3,$4,'REQUEST_REVISION','Fix body')",[a(3),step.id,step.version_id,(await letter(revising)).revision]);
 legacy=await save(5);await rows('update letters set current_version_id=null where id=$1',[legacy]);oldLegacy=await letter(legacy);
 await db.exec(readFileSync('supabase/migrations/'+unified,'utf8'));
 await db.exec('grant usage on schema public,app,auth to authenticated;grant select on letters,profiles,letter_versions,approval_steps,review_steps to authenticated;grant update on letters,approval_steps to authenticated;');
},30000);
afterAll(()=>db.close());
it('transitions waiting review to an explicit approval submission without changing document/history/number',async()=>{
 const l=await letter(waiting);expect(l).toMatchObject({status:'DRAFT',review_status:'NOT_REQUIRED',reviewer_id:null,previewed_revision:null,official_number:null,content_approval_required:true});
 expect(await rows('select * from letter_versions where letter_id=$1',[waiting])).toEqual(oldVersion);expect(await rows('select * from review_comments where step_id=(select id from review_steps where letter_id=$1)',[waiting])).toEqual(oldComments);
 expect((await rows('select status from review_steps where letter_id=$1',[waiting]))[0].status).toBe('SUPERSEDED');expect(await rows('select id from approval_steps where letter_id=$1',[waiting])).toHaveLength(0);
 await expect(rows("select issue_letter_number($1,$2,'cannot-skip')",[waiting,a(5)])).rejects.toThrow();await submit(waiting);expect((await letter(waiting)).status).toBe('IN_REVIEW');await decide(waiting,3,'APPROVE');expect((await letter(waiting)).status).toBe('READY_TO_ISSUE');
});
it('preserves old revision requests and requires new corrected version',async()=>{await expect(submit(revising)).rejects.toThrow(/versi baru/);const l=await letter(revising);await expect(save(5,{id:revising,revision:l.revision,hash:'try-skip',approvalRequired:false,additionalApproverIds:[]})).rejects.toThrow(/Pilih pemberi persetujuan/);await save(5,{id:revising,revision:l.revision,hash:'fixed-body',approvalRequired:true,additionalApproverIds:[a(3)]});await submit(revising);expect((await letter(revising)).status).toBe('IN_REVIEW');expect((await rows('select status from review_steps where letter_id=$1',[revising]))[0].status).toBe('REVISION_REQUESTED');});
it('does not rewrite versionless legacy letters',async()=>{const l=await letter(legacy);delete l.unified_approval;delete l.content_approval_required;delete l.approval_required_from_review;expect(l).toEqual(oldLegacy);});
it.each(['PERMOHONAN','LAPORAN','PEMBERITAHUAN',''])('no category creates separate review (%s)',async categoryCode=>{const id=await save(5,{categoryCode,reviewRequested:true,reviewerId:a(3),approvalRequired:true,additionalApproverIds:[a(4)]});await submit(id);expect(await rows('select id from review_steps where letter_id=$1',[id])).toHaveLength(0);expect((await letter(id)).status).toBe('IN_REVIEW');});
it('hierarchy is enforced at DB: related GM, higher SM/Dir; not peers/admin/other-unit GM',async()=>{
 for(const n of [4,3,2])expect((await rows('select app.content_approver($1,$2) ok',[a(5),a(n)]))[0].ok).toBe(true);
 expect((await rows('select app.content_approver($1,$2) ok',[a(6),a(4)]))[0].ok).toBe(false);
 for(const [creator,target] of [[4,3],[4,2],[3,2]] as const)expect((await rows('select app.content_approver($1,$2) ok',[a(creator),a(target)]))[0].ok).toBe(true);
 for(const [creator,target] of [[4,4],[3,4],[2,3],[5,1],[5,6]] as const)await expect(save(creator,{approvalRequired:true,additionalApproverIds:[a(target)]})).rejects.toThrow();
 await expect(save(6,{approvalRequired:true,additionalApproverIds:[a(4)],recipientUserId:a(3)})).rejects.toThrow(/hierarki/);
});
it('peer internal bypasses both approval and signing, but cannot sneak in an approver',async()=>{const id=await save(5,{recipientUserId:a(6)});await submit(id);expect((await letter(id)).status).toBe('READY_TO_ISSUE');expect(await rows('select id from approval_steps where letter_id=$1',[id])).toHaveLength(0);await expect(save(5,{recipientUserId:a(6),additionalApproverIds:[a(3)]})).rejects.toThrow(/sesama level/);});
it('Director needs no superior approval; external signature remains required',async()=>{const id=await save(2,{letterTypeCode:'KRE',signerIds:[a(3)],mandatoryApproverIds:[a(3)]});await submit(id,2);expect((await letter(id))).toMatchObject({status:'READY_TO_ISSUE',required_signature_count:1});expect(await rows('select id from approval_steps where letter_id=$1',[id])).toHaveLength(0);});
it('same active approver comments/revises/approves with version/hash and actor checks',async()=>{
 const id=await save(5,{approvalRequired:true,additionalApproverIds:[a(4)]});await submit(id);const before=await letter(id);
 await expect(decide(id,3,'COMMENT','Other actor')).rejects.toThrow(/penyetuju/);await expect(decide(id,4,'COMMENT','')).rejects.toThrow(/catatan/);await decide(id,4,'COMMENT','Please clarify');
 expect((await rows('select comments from approval_steps where letter_id=$1',[id]))[0].comments[0]).toMatchObject({actor_id:a(4),note:'Please clarify'});expect((await letter(id)).status).toBe('IN_REVIEW');await expect(decide(id,4,'APPROVE',null,before.revision)).rejects.toThrow(/berubah/);
 await expect(decide(id,4,'REQUEST_REVISION','')).rejects.toThrow(/Alasan/);await decide(id,4,'REQUEST_REVISION','Correct the body');await expect(submit(id)).rejects.toThrow(/versi baru/);
 let l=await letter(id);await save(5,{id,revision:l.revision,hash:'corrected',approvalRequired:true,additionalApproverIds:[a(4)]});await submit(id);await decide(id,4,'APPROVE');expect((await letter(id)).status).toBe('READY_TO_ISSUE');expect(await rows('select id from approval_steps where letter_id=$1',[id])).toHaveLength(2);
});
it('RLS denies former reviewer-only access and direct flag/comment forgery',async()=>{
 const id=await save(5,{approvalRequired:true,additionalApproverIds:[a(4)]});await submit(id);
 expect(await asUser(3,'select id from letters where id=$1',[id])).toHaveLength(0);expect(await asUser(1,'select id from letters where id=$1',[id])).toHaveLength(0);expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(1);
 expect(await asUser(4,'update approval_steps set comments=\'[{"note":"forged"}]\' where letter_id=$1 returning id',[id])).toEqual([]);expect((await rows('select comments from approval_steps where letter_id=$1',[id]))[0].comments).toEqual([]);
 await expect(rows("select decide_letter_review($1,gen_random_uuid(),gen_random_uuid(),0,'PASS',null)",[a(3)])).rejects.toThrow(/Persetujuan/);
 expect((await rows("select has_function_privilege('authenticated','review_letter(uuid,uuid,text,integer,text)','EXECUTE') allowed"))[0].allowed).toBe(false);
});

it('approver can reject with a mandatory reason and numbering stays blocked',async()=>{const id=await save(5,{approvalRequired:true,additionalApproverIds:[a(3)]});await submit(id);await expect(decide(id,3,'REJECT','')).rejects.toThrow(/Alasan/);await decide(id,3,'REJECT','Wrong request');expect((await letter(id)).status).toBe('REJECTED');await expect(rows("select issue_letter_number($1,$2,'rejected')",[id,a(5)])).rejects.toThrow();});
