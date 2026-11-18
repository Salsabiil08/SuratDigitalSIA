/** Investigasi terpisah: reproduksi fixture PR-01, tanpa migrasi PR-02. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const db=new PGlite();
beforeAll(async()=>{
 await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql','utf8'));
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f<='20261118043024_notifications_event_authorization.sql').sort())
  await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(readFileSync('supabase/seed.sql','utf8'));
},30000);
afterAll(()=>db.close());
it('fixture SQL baseline gagal sebelum PR-02 karena dokumen versi tidak disiapkan',async()=>{
 const sql=readFileSync('supabase/tests/01_numbering_test.sql','utf8').split('\n').filter(line=>!line.startsWith('\\')).join('\n');
 try { await expect(db.exec(sql)).rejects.toThrow('Surat belum siap diterbitkan.'); }
 finally { await db.exec('rollback'); }
 expect((await db.query('select id from number_issuances')).rows).toHaveLength(0);
});
it('status READY saja bukan bukti versi dokumen; guard tetap menolak tanpa menaikkan nomor',async()=>{
 await db.exec(`insert into letters(id,letter_type_id,source,status,subject,creator_id,creator_unit_id,recipient_type)
 values('c0000000-0000-0000-0000-000000000001',(select id from letter_types where code='IN'),'CREATE','READY_TO_ISSUE','Reproduksi fixture','a0000000-0000-0000-0000-000000000005',(select id from organizational_units where code='ACH'),'INTERNAL_USER')`);
 const l=(await db.query<any>("select current_version_id from letters where id='c0000000-0000-0000-0000-000000000001'")).rows[0];expect(l.current_version_id).toBeNull();
 await expect(db.query("select issue_letter_number('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005','baseline-fixture')")).rejects.toThrow('Surat belum siap diterbitkan.');
 expect((await db.query('select * from number_counters')).rows).toHaveLength(0);
});
