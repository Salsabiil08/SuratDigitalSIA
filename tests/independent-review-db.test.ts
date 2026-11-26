import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { jakartaDate } from '../src/domain/workflow';
const db = new PGlite();
const actor = (n: number) => `a0000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const rows = async (sql: string, p: any[] = []) => (await db.query<any>(sql,p)).rows;
const get = async (id: string) => (await rows('select * from letters where id=$1',[id]))[0];
const steps = (id: string) => rows('select * from review_steps where letter_id=$1 order by cycle desc',[id]);
async function draft(extra: any = {}, n = 5) {
 const p = { source:'CREATE',letterTypeCode:'IN',categoryCode:'PERMOHONAN',reviewerId:actor(4),subject:'Naskah uji review',letterDate:jakartaDate(),recipientUserId:actor(6),recipientName:'Pihak luar',recipientOrg:'Instansi',recipientAddress:'Alamat',content:'Isi',signatureMode:'IN_APP',signerIds:[],areas:[],...extra };
 return (await rows('select save_letter_draft($1,$2::jsonb,$3::jsonb) id',[actor(n),JSON.stringify(p),JSON.stringify({path:actor(n)+'/review.docx',hash:extra.hash||'review-hash',format:'DOCX'})]))[0].id;
}
async function act(id: string, action: string, n=5) { const l=await get(id);return rows('select review_letter($1,$2,$3,$4,null) result',[actor(n),id,action,l.revision]); }
async function submit(id: string) {await act(id,'PREVIEW'); return act(id,'SUBMIT');}
async function decide(id: string, action='PASS', note: string|null=null, n=4, overrides:any={}) {
 const l=await get(id), s=(await steps(id))[0];
 return rows('select decide_letter_review($1,$2,$3,$4,$5,$6)',[actor(n),overrides.step||s.id,overrides.version||s.version_id,overrides.revision??l.revision,action,note]);
}
async function asUser(n: number, sql: string, params:any[] = []) {
 await db.exec('begin');
 try { await rows("select set_config('request.jwt.claim.sub',$1,true)",[actor(n)]); await db.exec('set local role authenticated');return await rows(sql,params); }
 finally {await db.exec('rollback');}
}
beforeAll(async()=>{
 await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql','utf8'));
 const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.endsWith('_unified_content_approval.sql')).sort();
 for(const f of files.filter(f=>f<'20261118045220'))await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(readFileSync('supabase/seed.sql','utf8'));
 // Simulasi 13 surat bernomor lama tanpa versi. Migrasi tidak boleh menyentuhnya.
 await db.exec(`insert into letters(letter_type_id,creator_id,creator_unit_id,status,subject,official_number,recipient_type,issued_at) select (select id from letter_types where code='IN'),'${actor(5)}',(select id from organizational_units where code='ACH'),'NUMBERED','Legacy dilindungi '||g,'LEGACY-'||g,'INTERNAL_USER',now() from generate_series(1,13) g`);
 const before=await rows("select to_jsonb(l) row from letters l where subject like 'Legacy dilindungi%' order by id");
 const auditBefore=await rows('select * from audit_logs order by id');
 for(const f of files.filter(f=>f>='20261118045220'))await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 // Kolom baru NULL adalah tambahan schema, bukan bukti review/backfill.
 const after=(await rows("select to_jsonb(l) row from letters l where subject like 'Legacy dilindungi%' order by id")).map(r=>({row:Object.fromEntries(Object.keys(before[0].row).map(k=>[k,r.row[k]]))}));
 expect(after).toEqual(before);expect(await rows('select * from audit_logs order by id')).toEqual(auditBefore);
 await db.exec(`grant usage on schema public,app,auth to authenticated; grant select on profiles,letters,letter_versions,approval_steps to authenticated; grant update on letters to authenticated;
 insert into review_policy_managers(profile_id) values('${actor(2)}');
 select authorize_letter_reviewer('${actor(2)}','${actor(4)}',(select id from organizational_units where code='ACH'),null,true,null,'Penugasan pengujian perusahaan');`);
},30000);
afterAll(()=>db.close());
describe('Historical PR-02 before unified approval migration', { concurrent: false }, () =>{
 it('pilihan Tidak melewati pemeriksaan kategori lama tanpa mengubah nomor otomatis',async()=>{
  const id=await draft({categoryCode:'LAPORAN',reviewRequested:false,reviewerId:''});await submit(id);
  expect((await get(id)).review_requested).toBe(false);expect((await get(id)).review_status).toBe('NOT_REQUIRED');expect((await get(id)).status).toBe('READY_TO_ISSUE');expect((await get(id)).official_number).toBeNull();expect(await steps(id)).toHaveLength(0);
  await rows("select issue_letter_number($1,$2,'optional-no-review')",[id,actor(5)]);expect((await get(id)).official_number).toBeTruthy();
 });
 it('pilihan Ya menyimpan draf tanpa pemeriksa tetapi menolak pengajuan',async()=>{
  const id=await draft({categoryCode:'',reviewRequested:true,reviewerId:''});expect((await get(id)).review_requested).toBe(true);await expect(submit(id)).rejects.toThrow(/Pemeriksa/);expect((await get(id)).official_number).toBeNull();
 });
 it('pilihan Ya menunggu pemeriksaan versi terkini sebelum persetujuan',async()=>{
  const id=await draft({categoryCode:'',reviewRequested:true});await submit(id);expect((await get(id)).review_status).toBe('WAITING');await decide(id);await submit(id);expect((await get(id)).status).toBe('READY_TO_ISSUE');
 });
 it('pilihan Tidak tidak boleh menyelundupkan pemeriksa atau mengubah flag langsung',async()=>{
  await expect(draft({reviewRequested:false})).rejects.toThrow(/Pilih Ya/);
  const id=await draft({reviewRequested:true});expect(await asUser(5,'update letters set review_requested=false where id=$1 returning id',[id])).toEqual([]);expect((await get(id)).review_requested).toBe(true);
 });
 it.each(['PERMOHONAN','LAPORAN'])('%s wajib reviewer, kategori kosong tidak bisa melewati gate',async categoryCode=>{
  const id=await draft({categoryCode,reviewerId:''});await expect(submit(id)).rejects.toThrow(/Pemeriksa/);
  expect((await get(id)).official_number).toBeNull();
 });
 it('kategori kosong/tidak aktif ditolak di server/database',async()=>{
  await expect(draft({categoryCode:''})).rejects.toThrow(/kategori/);
  await expect(draft({categoryCode:'TIDAK_ADA'})).rejects.toThrow(/kategori/);
 });
 it('Pemberitahuan boleh tanpa review; tetap tidak menerbitkan nomor otomatis',async()=>{
  const id=await draft({categoryCode:'PEMBERITAHUAN',reviewerId:''});await submit(id);
  expect((await get(id)).status).toBe('READY_TO_ISSUE');expect((await get(id)).official_number).toBeNull();
  expect(await steps(id)).toHaveLength(0);
 });
 it('reviewer opsional yang dipilih tetap harus menyelesaikan pemeriksaan',async()=>{
  const id=await draft({categoryCode:'PEMBERITAHUAN'});await submit(id);
  expect((await get(id)).review_status).toBe('WAITING');expect((await get(id)).status).toBe('DRAFT');
 });
 it('self-review dan admin ditolak, pejabat lebih tinggi lintas unit tidak memerlukan grant',async()=>{
  await expect(draft({reviewerId:actor(5)})).rejects.toThrow(/pemeriksa/);
  await expect(draft({reviewerId:actor(1)})).rejects.toThrow(/pemeriksa/);
  await expect(draft({reviewerId:actor(3)})).resolves.toBeTruthy();
  await expect(draft({reviewerId:actor(4)},6)).resolves.toBeTruthy();
 });
 it('komentar, lolos pemeriksaan, approval dan TTD tidak dicampur',async()=>{
  const id=await draft({letterTypeCode:'KRE',signerIds:[actor(2)]});await submit(id);
  expect(await rows('select * from approval_steps where letter_id=$1',[id])).toHaveLength(0);
  expect(await rows('select * from signature_requests where letter_id=$1',[id])).toHaveLength(0);
  await expect(decide(id,'COMMENT',' ',4)).rejects.toThrow(/Catatan/);
  await decide(id,'COMMENT','Periksa penerima');await decide(id);
  expect((await get(id)).status).toBe('DRAFT');expect((await get(id)).review_status).toBe('PASSED');
  expect((await get(id)).official_number).toBeNull();
  await submit(id);expect((await get(id)).status).toBe('IN_REVIEW');
  expect(await rows("select * from approval_steps where letter_id=$1 and status='PENDING' and approver_id=$2",[id,actor(2)])).toHaveLength(1);
  await expect(act(id,'APPROVE',4)).rejects.toThrow(/penyetuju/);
  await act(id,'APPROVE',2);expect((await get(id)).status).toBe('READY_TO_ISSUE');
 });
 it('penerima, admin dan reviewer lain tidak dapat memutuskan pemeriksaan',async()=>{
  const id=await draft();await submit(id);
  await expect(decide(id,'PASS',null,6)).rejects.toThrow(/pemeriksa/);
  await expect(decide(id,'PASS',null,1)).rejects.toThrow(/pemeriksa/);
 });
 it('keputusan stale/duplikat dan aksi di luar daftar ditolak',async()=>{
  const id=await draft();await submit(id);const l=await get(id);
  await expect(decide(id,'PASS',null,4,{revision:l.revision-1})).rejects.toThrow(/versi/);
  await expect(decide(id,'APPROVE')).rejects.toThrow(/tidak valid/);
  await decide(id);await expect(decide(id)).rejects.toThrow(/pemeriksa/);
 });
 it('minta revisi perlu catatan dan versi baru; riwayat keputusan tetap utuh',async()=>{
  const id=await draft();await submit(id);const old=await get(id);
  await expect(decide(id,'REQUEST_REVISION',' ')).rejects.toThrow(/Catatan/);
  await decide(id,'REQUEST_REVISION','Perbaiki tujuan');await expect(submit(id)).rejects.toThrow(/versi baru/);
  const l=await get(id);await draft({id,revision:l.revision,content:'Isi dikoreksi',hash:'new-hash'});
  const edited=await get(id);expect(edited.current_version_id).not.toBe(old.current_version_id);
  expect(edited.letter_date).toEqual(old.letter_date);expect((await steps(id))[0].status).toBe('REVISION_REQUESTED');
  await submit(id);await decide(id);expect(await steps(id)).toHaveLength(2);
 });
 it('edit setelah lolos membatalkan keberlakuan keputusan lama dan akses reviewer',async()=>{
  const id=await draft();await submit(id);await decide(id);const l=await get(id);
  await draft({id,revision:l.revision,content:'Naskah baru'});
  expect((await rows('select app.review_passed($1) yes',[id]))[0].yes).toBe(false);
  expect((await steps(id))[0].status).toBe('PASSED');
  expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(0);
  await submit(id);expect((await get(id)).review_status).toBe('WAITING');
 });
 it('RLS hanya membuka versi penugasan terkini, bukan arsip versi lain',async()=>{
  const id=await draft();let l=await get(id);const old=l.current_version_id;
  await draft({id,revision:l.revision,content:'Versi kedua'});await submit(id);l=await get(id);
  expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(1);
  const visible=await asUser(4,'select id from letter_versions where letter_id=$1',[id]);
  expect(visible.map(r=>r.id)).toEqual([l.current_version_id]);expect(visible.map(r=>r.id)).not.toContain(old);
  expect(await asUser(6,'select id from letters where id=$1',[id])).toHaveLength(0);
  expect(await asUser(1,'select id from letters where id=$1',[id])).toHaveLength(0);
  expect(await asUser(4,"update letters set subject='Diedit reviewer' where id=$1 returning id",[id])).toHaveLength(0);
  await expect(draft({id,revision:l.revision,reviewerId:""},4)).rejects.toThrow(/diubah/);
  await expect(asUser(4,"insert into review_comments(step_id,actor_id,note) values($1,$2,'Palsu')",[(await steps(id))[0].id,actor(4)])).rejects.toThrow(/permission denied/);
 });
 it('hak reviewer dicabut/nonaktif/berakhir tidak dapat mengambil keputusan atau menerbitkan nomor',async()=>{
  const id=await draft();await submit(id);await decide(id);await submit(id);
  await db.exec(`update user_assignments set is_active=false where profile_id='${actor(4)}'`);
  try {
   expect(await asUser(4,'select id from letters where id=$1',[id])).toHaveLength(0);
   await expect(rows('select issue_letter_number($1,$2,$3)',[id,actor(5),'review-expired'])).rejects.toThrow(/Pemeriksaan/);
  } finally {await db.exec(`update user_assignments set is_active=true where profile_id='${actor(4)}'`);}
 });
 it('override jenis mengharuskan Pemberitahuan direview dan config hanya pengelola perusahaan',async()=>{
  await expect(rows('select configure_review_policy($1,$2,null,true,$3)',[actor(1),'PEMBERITAHUAN','Uji admin'])).rejects.toThrow(/pengelola/);
  await expect(rows('select configure_review_policy($1,$2,null,false,$3)',[actor(2),'LAPORAN','Uji penurunan'])).rejects.toThrow(/wajib/);
  const type=(await rows("select id from letter_types where code='KRE'"))[0].id;
  await rows('select configure_review_policy($1,$2,$3,true,$4)',[actor(2),'PEMBERITAHUAN',type,'Kebijakan uji per jenis']);
  const id=await draft({categoryCode:'PEMBERITAHUAN',letterTypeCode:'KRE',signerIds:[actor(2)],reviewerId:''});
  await expect(submit(id)).rejects.toThrow(/Pemeriksa/);
 });
 it('perubahan policy membuat penugasan/keputusan lama tidak berlaku',async()=>{
  const id=await draft();await submit(id);await decide(id);
  await rows('select configure_review_policy($1,$2,null,true,$3)',[actor(2),'PERMOHONAN','Versi kebijakan baru']);
  await submit(id);expect((await get(id)).review_status).toBe('WAITING');expect(await steps(id)).toHaveLength(2);
 });
 it('gagal event membatalkan keputusan, status dan audit sekaligus',async()=>{
  const id=await draft();await submit(id);const before=await get(id);
  const counts=await rows('select (select count(*) from audit_logs) a,(select count(*) from notifications) n');
  await db.exec("create function app.fail_review_event() returns trigger language plpgsql as $$ begin raise exception 'Event gagal'; end $$; create trigger fail_review_event before insert on notifications for each row execute function app.fail_review_event()");
  try {
   await expect(decide(id)).rejects.toThrow(/Event gagal/);expect(await get(id)).toEqual(before);
   expect((await steps(id))[0].status).toBe('PENDING');expect(await rows('select (select count(*) from audit_logs) a,(select count(*) from notifications) n')).toEqual(counts);
  } finally {await db.exec('drop trigger fail_review_event on notifications; drop function app.fail_review_event()');}
 });
 it('RPC dan helper aktor arbitrer tidak tersedia untuk klien',async()=>{
  for(const fn of ['decide_letter_review(uuid,uuid,uuid,integer,text,text)','save_letter_draft_pre_review(uuid,jsonb,jsonb)','review_letter_pre_review(uuid,uuid,text,integer,text)','issue_letter_number_pre_review(uuid,uuid,text)','configure_review_policy(uuid,text,uuid,boolean,text)','authorize_letter_reviewer(uuid,uuid,uuid,uuid,boolean,date,text)','app.authorized_reviewer(uuid,uuid,uuid)','app.can_read_letter_for(uuid,uuid)']) {
   const r=(await rows("select has_function_privilege('authenticated',$1,'execute') u,has_function_privilege('anon',$1,'execute') a",[fn]))[0];expect(r.u).toBe(false);expect(r.a).toBe(false);
  }
 });
});

it('review tagihan terpisah dari dua approval/TTD berurutan dan lampiran tetap wajib',async()=>{
 const type=(await rows("select id from letter_types where code='Tag'"))[0].id;
 const unit=(await rows("select id from organizational_units where code='FIN'"))[0].id;
 await rows('select authorize_letter_reviewer($1,$2,$3,$4,true,null,$5)',[actor(2),actor(4),unit,type,'Pemeriksa tagihan dalam pengujian']);
 const bank=(await rows("insert into master_bank(name,is_active) values('Bank Review',true) returning id"))[0].id;
 const id=await draft({letterTypeCode:'Tag',categoryCode:'LAPORAN',signerIds:[actor(3),actor(2)],billing:{bankId:bank,accountNumber:'123',accountHolder:'Perusahaan',items:[{description:'A',amount:100},{description:'B',amount:200}]}},6);
 await act(id,'PREVIEW',6);await act(id,'SUBMIT',6);
 await decide(id);expect(await rows('select id from approval_steps where letter_id=$1',[id])).toHaveLength(0);
 await act(id,'PREVIEW',6);await expect(act(id,'SUBMIT',6)).rejects.toThrow(/Lampiran/);
 await rows('insert into letter_attachments(letter_id,file_name,storage_path,mime_type,size_bytes,uploaded_by) values($1,$2,$3,$4,100,$5)',[id,'bukti.pdf','bukti','application/pdf',actor(6)]);
 await act(id,'SUBMIT',6);
 const approvals=await rows('select approver_id,status from approval_steps where letter_id=$1 order by step_order',[id]);
 expect(approvals).toEqual([{approver_id:actor(3),status:'PENDING'},{approver_id:actor(2),status:'WAITING'}]);
 expect((await get(id)).official_number).toBeNull();
});
it('review tidak dapat dipalsukan melalui PATCH field baru atau INSERT surat langsung',async()=>{
 const id=await draft();
 expect(await asUser(5,"update letters set review_status='PASSED' where id=$1 returning id",[id])).toEqual([]);
 expect(await asUser(5,'update letters set category_id=null where id=$1 returning id',[id])).toEqual([]);
 await db.exec("create policy test_review_update on letters for update to authenticated using(creator_id=auth.uid()) with check(creator_id=auth.uid())");
 try {await expect(asUser(5,"update letters set review_status='PASSED' where id=$1",[id])).rejects.toThrow(/alur resmi/);}finally{await db.exec('drop policy test_review_update on letters');}
 // Grant INSERT bukan izin bypass helper aplikasi: trigger tetap menolak.
 await db.exec('grant insert on letters to authenticated');
 await expect(asUser(5,"insert into letters(creator_id) values($1)",[actor(5)])).rejects.toThrow(/melalui aplikasi/);
});
it('review versi yang salah, akun nonaktif dan penugasan berakhir ditolak',async()=>{
 const id=await draft();await submit(id);
 await expect(decide(id,'PASS',null,4,{version:'00000000-0000-0000-0000-000000000099'})).rejects.toThrow(/versi/);
 await db.exec(`update profiles set is_active=false where id='${actor(4)}'`);
 try {await expect(decide(id)).rejects.toThrow(/pemeriksa/);}finally {await db.exec(`update profiles set is_active=true where id='${actor(4)}'`);}
 // Gunakan rentang sah yang memang telah berakhir.
 await db.exec(`update user_assignments set start_date=current_date-10,end_date=current_date-1 where profile_id='${actor(4)}'`);
 try {await expect(decide(id)).rejects.toThrow(/pemeriksa/);}finally {await db.exec(`update user_assignments set start_date=current_date,end_date=null,is_active=true where profile_id='${actor(4)}'`);}
});
it('pengajuan ulang saat menunggu tidak menggandakan tugas/notifikasi',async()=>{
 const id=await draft();await submit(id);const before=await rows('select id from notifications where letter_id=$1',[id]);
 await act(id,'SUBMIT');expect(await steps(id)).toHaveLength(1);expect(await rows('select id from notifications where letter_id=$1',[id])).toEqual(before);
});

it('role hierarchy allows exactly higher SIA roles without manual reviewer grants',async()=>{
 const rank:Record<number,number>={1:0,2:4,3:3,4:2,5:1,6:1};
 for(const creator of [2,3,4,5,6])for(const reviewer of [1,2,3,4,5,6]){
  const allowed=(await rows('select app.review_hierarchy($1,$2) allowed',[actor(creator),actor(reviewer)]))[0].allowed;
  expect(allowed,`creator ${creator}, reviewer ${reviewer}`).toBe(creator!==reviewer&&rank[reviewer]!>rank[creator]!);
 }
});
it('all creation paths accept higher reviewers with zero reviewer grants and preserve assignment-scoped access',async()=>{
 await db.exec('begin');
 try{
  await db.exec('delete from review_authorizations');
  for(const source of ['CREATE','UPLOAD'])for(const [creator,reviewer] of ([[5,4],[5,3],[5,2],[4,3],[4,2],[3,2]] as const)){
   const id=await draft({source,reviewRequested:true,reviewerId:actor(reviewer)},creator);
   const l=await get(id);await act(id,'PREVIEW',creator);await rows('select submit_letter_for_approval($1,$2,$3,false)',[actor(creator),id,l.revision]);
   expect((await get(id)).review_status).toBe('WAITING');expect((await steps(id))[0].reviewer_id).toBe(actor(reviewer));
  }
  const visibleAs=async(n:number,id:string)=>{await rows("select set_config('request.jwt.claim.sub',$1,true)",[actor(n)]);await db.exec('set local role authenticated');try{return await rows('select id from letters where id=$1',[id]);}finally{await db.exec('reset role');}};
  const id=await draft({reviewRequested:true,reviewerId:actor(4)});expect(await visibleAs(4,id)).toHaveLength(0);await submit(id);
  expect(await visibleAs(4,id)).toHaveLength(1);
  expect(await visibleAs(2,id)).toHaveLength(0);
 }finally{await db.exec('rollback');}
});
it('a manual grant cannot authorize peer, lower, staff or technical admin as reviewer',async()=>{
 for(const [creator,reviewer] of ([[4,4],[4,5],[3,4],[2,3],[5,1]] as const))await expect(draft({reviewRequested:true,reviewerId:actor(reviewer)},creator)).rejects.toThrow(/pemeriksa/);
});
