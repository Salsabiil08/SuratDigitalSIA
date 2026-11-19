import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
const db=new PGlite();const actor=(n:number)=>`a0000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const rows=async(sql:string,p:any[]=[]) =>(await db.query<any>(sql,p)).rows;
const get=async(id:string)=>(await rows('select * from letters where id=$1',[id]))[0];
async function draft(extra:any={},n=5){return(await rows('select test_support.draft($1,$2,$3,$4,$5,$6,$7) id',[actor(n),extra.type||'IN',(extra.signers||[]).map(actor),extra.category||'PEMBERITAHUAN',extra.reviewer?actor(extra.reviewer):null,extra.mandatory?extra.mandatory.map(actor):null,(extra.extra||[]).map(actor)]))[0].id;}
const submit=(id:string,n=5,confirm=false)=>rows('select test_support.submit($1,$2,$3)',[actor(n),id,confirm]);
async function decide(id:string,n:number,action='APPROVE',note:string|null=null){const l=await get(id);return rows('select review_letter($1,$2,$3,$4,$5)',[actor(n),id,action,l.revision,note]);}
const steps=(id:string)=>rows('select * from approval_steps where letter_id=$1 order by cycle,step_order',[id]);
async function asUser(n:number,sql:string,p:any[]=[]){await db.exec('begin');try{await rows("select set_config('request.jwt.claim.sub',$1,true)",[actor(n)]);await db.exec('set local role authenticated');return await rows(sql,p);}finally{await db.exec('rollback');}}
beforeAll(async()=>{
 await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql','utf8'));
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(readFileSync('supabase/seed.sql','utf8'));await db.exec(readFileSync('supabase/tests/00_workflow_fixtures.sql','utf8'));
 await db.exec(`grant usage on schema public,app,auth to authenticated;grant select on letters,profiles,letter_versions,approval_steps to authenticated;
 insert into approval_policy_managers values('${actor(2)}');insert into review_policy_managers values('${actor(2)}');
 select authorize_letter_approver('${actor(2)}','${actor(4)}',null,null,true,null,'Uji penyetuju tambahan');
 select authorize_letter_approver('${actor(2)}','${actor(3)}',null,null,true,null,'Uji kewenangan Finance');
 select authorize_letter_reviewer('${actor(2)}','${actor(4)}',null,null,true,null,'Uji pemeriksa');`);
},30000);afterAll(()=>db.close());
it('internal biasa tanpa TTD tidak diberi persetujuan atau nomor otomatis',async()=>{
 const id=await draft();await submit(id);expect(await steps(id)).toHaveLength(0);expect((await get(id)).status).toBe('READY_TO_ISSUE');expect((await get(id)).official_number).toBeNull();
});
it.each(['IN','KRE'])('%s formal: penyetuju berbeda dari penandatangan; nomor menunggu keputusan sah',async type=>{
 const id=await draft({type,signers:[2],mandatory:[3]});await submit(id);
 expect((await steps(id)).map(s=>s.approver_id)).toEqual([actor(3)]);
 await expect(decide(id,2)).rejects.toThrow(/penyetuju/);await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'not-ready'])).rejects.toThrow();
 await decide(id,3);await rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'different-roles-'+id]);
 expect((await rows('select signer_id from signature_requests where letter_id=$1',[id]))[0].signer_id).toBe(actor(2));
});
it('pembuat pejabat mengonfirmasi versi saat pengajuan, tidak dipaksa menyetujui dua kali',async()=>{
 const id=await draft({type:'KRE',signers:[3],mandatory:[3],extra:[3,3]},3);
 await expect(submit(id,3)).rejects.toThrow(/Konfirmasikan/);expect(await steps(id)).toHaveLength(0);
 await submit(id,3,true);const s=await steps(id);expect(s).toHaveLength(1);expect(s[0]).toMatchObject({status:'APPROVED',decision_origin:'CREATOR_SUBMISSION'});
 expect((await get(id)).official_number).toBeNull();await expect(decide(id,3)).rejects.toThrow();
 await rows('select issue_letter_number($1,$2,$3)',[id,actor(3),'creator-self']);
 expect((await rows('select status from signature_requests where letter_id=$1',[id]))[0].status).toBe('PENDING');
});
it('tambahan duplikat digabung; jumlah approval tidak lagi sama dengan jumlah TTD',async()=>{
 const id=await draft({type:'KRE',signers:[2],mandatory:[3],extra:[4,4,3]});await submit(id);
 expect(await steps(id)).toHaveLength(2);await expect(decide(id,4)).rejects.toThrow(/penyetuju/);
 await decide(id,3);await decide(id,4);await rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'two-approvals-one-signature']);
 expect((await rows('select id from signature_requests where letter_id=$1',[id]))).toHaveLength(1);
});
it('review tidak menjadi approval; pengguna dengan dua peran tetap memutuskan setiap jenis tindakan',async()=>{
 const id=await draft({type:'KRE',signers:[2],mandatory:[3],extra:[4],category:'PERMOHONAN',reviewer:4});await submit(id);
 const r=(await rows('select * from review_steps where letter_id=$1',[id]))[0];let l=await get(id);
 await rows('select decide_letter_review($1,$2,$3,$4,$5,null)',[actor(4),r.id,r.version_id,l.revision,'PASS']);
 expect(await steps(id)).toHaveLength(0);await submit(id);await decide(id,3);expect((await get(id)).status).toBe('IN_REVIEW');await decide(id,4);
});
it('restart mewajibkan versi baru, mempertahankan keputusan lama dan mengulang approval',async()=>{
 const id=await draft({type:'KRE',signers:[2]});await submit(id);await decide(id,2);const l=await get(id),old=(await steps(id))[0];
 await rows('select restart_letter_approval($1,$2,$3,$4)',[actor(5),id,l.revision,'Koreksi substansi']);
 await expect(submit(id)).rejects.toThrow(/versi baru/);
 const curr=await get(id);await rows('select save_letter_draft($1,$2::jsonb,$3::jsonb)',[actor(5),JSON.stringify({id,revision:curr.revision,source:'CREATE',letterTypeCode:'KRE',categoryCode:'PEMBERITAHUAN',subject:'Revisi',letterDate:curr.letter_date,recipientName:'R',recipientOrg:'O',recipientAddress:'A',signatureMode:'IN_APP',signerIds:[actor(2)],content:'Revisi',areas:[]}),JSON.stringify({path:'edited.docx',format:'DOCX',hash:'changed'})]);
 expect((await get(id)).current_version_id).not.toBe(old.version_id);await submit(id);
 expect((await steps(id))[0].status).toBe('APPROVED');expect((await steps(id))[1].status).toBe('PENDING');
 await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'stale-approval'])).rejects.toThrow();
});
it('RLS menolak pengguna lain dan approver lama pada versi draft baru',async()=>{
 const id=await draft({type:'KRE',signers:[2],mandatory:[3],extra:[4]});await submit(id);
 expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(0); // tambahan masih WAITING
 await decide(id,3);expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(1);
 await expect(asUser(4,'select review_letter($1,$2,$3,0,null)',[actor(4),id,'APPROVE'])).rejects.toThrow(/permission denied/);
 expect(await asUser(1,'select id from letters where id=$1',[id])).toHaveLength(0);
});
it('pencabutan grant/akun nonaktif menutup keputusan dan penerbitan',async()=>{
 const id=await draft({extra:[4]});await submit(id);await db.exec(`update approver_authorizations set is_active=false where approver_id='${actor(4)}'`);
 try{await expect(decide(id,4)).rejects.toThrow(/penugasan/);expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(0);}finally{await db.exec(`update approver_authorizations set is_active=true where approver_id='${actor(4)}'`);}
 await decide(id,4);await db.exec(`update profiles set is_active=false where id='${actor(4)}'`);
 try{await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'inactive-approver'])).rejects.toThrow();}finally{await db.exec(`update profiles set is_active=true where id='${actor(4)}'`);}
});
it('gagal notifikasi membatalkan approval, status, giliran dan audit sekaligus',async()=>{
 const id=await draft({type:'KRE',signers:[2],extra:[4]});await submit(id);const before=await steps(id),l=await get(id);
 await db.exec("create function app.fail_approval_event() returns trigger language plpgsql as $$ begin raise exception 'Event gagal';end $$;create trigger fail_approval_event before insert on notifications for each row execute function app.fail_approval_event()");
 try{await expect(decide(id,2)).rejects.toThrow(/Event gagal/);expect(await steps(id)).toEqual(before);expect(await get(id)).toEqual(l);}finally{await db.exec('drop trigger fail_approval_event on notifications;drop function app.fail_approval_event()');}
});
it('otorisasi tambahan tidak diwarisi otomatis dari Super Admin atau pemeriksa',async()=>{
 await expect(draft({extra:[1]})).rejects.toThrow(/penugasan/);
 await expect(rows('select authorize_letter_approver($1,$2,null,null,true,null,$3)',[actor(4),actor(6),'Tanpa otoritas'])).rejects.toThrow(/pengelola/);
});
it('tagihan pembuat SM Finance: tidak ada approval ganda, Direktur tetap wajib dan TTD berurutan',async()=>{
 const id=await draft({type:'Tag',signers:[3,2],extra:[3]},3);await submit(id,3,true);
 const s=await steps(id);expect(s).toHaveLength(2);expect(s.map(x=>x.status)).toEqual(['APPROVED','PENDING']);
 await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(3),'billing-before-dir'])).rejects.toThrow();
 await decide(id,2);await rows('select issue_letter_number($1,$2,$3)',[id,actor(3),'billing-complete']);
 expect((await rows('select signer_id,status from signature_requests where letter_id=$1 order by sign_order',[id]))).toEqual([{signer_id:actor(3),status:'PENDING'},{signer_id:actor(2),status:'WAITING'}]);
});
it('pembuat Direktur yang berwenang di Finance: konfirmasi pengajuan berlaku sesudah SM Finance',async()=>{
 await db.exec('begin');try{
  await rows("update user_assignments set unit_id=(select id from organizational_units where code='FIN') where profile_id=$1",[actor(2)]);
  const id=await draft({type:'Tag',signers:[3,2]},2);await submit(id,2,true);
  const s=await steps(id);expect(s.map(x=>x.status)).toEqual(['PENDING','WAITING']);expect(s[1].decided_at).toBeNull();expect(s[1].creator_confirmed_at).not.toBeNull();
  await db.exec('savepoint out_of_order');await expect(decide(id,2)).rejects.toThrow(/penyetuju/);await db.exec('rollback to savepoint out_of_order');await decide(id,3);
  expect((await steps(id)).map(x=>x.status)).toEqual(['APPROVED','APPROVED']);expect((await get(id)).status).toBe('READY_TO_ISSUE');
 }finally{await db.exec('rollback');}
});
it('tagihan menolak urutan salah dan SM tanpa mandat Finance lintas unit',async()=>{
 await expect(draft({type:'Tag',signers:[3,2],mandatory:[2,3]},6)).rejects.toThrow(/kewenangan/);
 await db.exec('begin');try{
  await rows("update user_assignments set unit_id=(select id from organizational_units where code='ACH') where profile_id=$1",[actor(3)]);
  await rows('update approver_authorizations set is_active=false where approver_id=$1',[actor(3)]);
  await expect(draft({type:'Tag',signers:[3,2]},6)).rejects.toThrow(/kewenangan/);
 }finally{await db.exec('rollback');}
});
it('gagal audit penomoran rollback allocator, counter, dan antrean tanda tangan',async()=>{
 const id=await draft();await submit(id);const before=await rows('select * from number_counters order by id');
 await db.exec("create function app.fail_number_audit() returns trigger language plpgsql as $$ begin if new.action='NUMBER_ISSUED' then raise exception 'Audit nomor gagal';end if;return new;end $$;create trigger fail_number_audit before insert on audit_logs for each row execute function app.fail_number_audit()");
 try{await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'fault-number'])).rejects.toThrow(/Audit nomor gagal/);expect((await get(id)).official_number).toBeNull();expect(await rows('select * from number_counters order by id')).toEqual(before);expect(await rows('select id from signature_requests where letter_id=$1',[id])).toHaveLength(0);}finally{await db.exec('drop trigger fail_number_audit on audit_logs;drop function app.fail_number_audit()');}
});
it('hash/revisi yang berubah tidak dapat memakai keputusan lama',async()=>{
 const id=await draft({type:'KRE',signers:[2]});await submit(id);await decide(id,2);
 await rows("update letter_versions set file_hash='changed-outside-version-flow' where id=(select current_version_id from letters where id=$1)",[id]);
 await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'bad-hash'])).rejects.toThrow(/belum lengkap/);
});
