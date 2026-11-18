import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it } from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
const db=new PGlite();
const sql=(p:string)=>readFileSync(p,'utf8').split('\n').filter(l=>!l.startsWith('\\')).join('\n');
beforeAll(async()=>{
 await db.exec(sql('supabase/tests/00_stub_supabase.sql'));
 await db.exec(sql('supabase/tests/00_stub_storage.sql'));
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(sql('supabase/migrations/'+f));
 await db.exec(sql('supabase/seed.sql'));await db.exec(sql('supabase/tests/00_workflow_fixtures.sql'));
},30000);
afterAll(()=>db.close());
it('fixture penomoran/pembatalan/disposisi sesuai alur RPC nyata',async()=>{await db.exec(sql('supabase/tests/01_numbering_test.sql'));});
it('fixture RLS tidak memberi grant ALL atau menganggap pengguna boleh bypass RPC',async()=>{await db.exec(sql('supabase/tests/02_rls_test.sql'));});

it('fixture approval independen, self-confirmation, tagihan dan review terpisah',async()=>{await db.exec(sql('supabase/tests/03_approval_test.sql'));});

it('fixture pengiriman/penerimaan/rollback/RLS/Storage',async()=>{await db.exec(sql('supabase/tests/04_internal_delivery_test.sql'));});

it('fixture kotak masuk/keluar, filter/pagination, otorisasi/CC dan error',async()=>{await db.exec(sql('supabase/tests/05_mailbox_test.sql'));});

it('fixture balasan resmi, relasi/RLS, nomor baru, retry dan rollback',async()=>{await db.exec(sql('supabase/tests/06_official_replies_test.sql'));});
