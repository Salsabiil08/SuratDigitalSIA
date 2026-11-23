import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
it('enforces comment permissions, idempotency, RLS, rollback and unchanged letter/receipt/number history',async()=>{
 const db=new PGlite();try{await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql','utf8'));for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));await db.exec(readFileSync('supabase/seed.sql','utf8'));await db.exec(readFileSync('supabase/tests/00_workflow_fixtures.sql','utf8'));await db.exec(readFileSync('supabase/tests/11_letter_comments_test.sql','utf8'));expect((await db.query('select * from letter_comments')).rows).toHaveLength(0);}finally{await db.close();}
},30000);
