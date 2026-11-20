// Pembuat artefak SQL saja. Tidak memiliki koneksi DB atau menjalankan production.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const expected=['20261117204405','20261117204922','20261117210259','20261117213134','20261118012449','20261118013200','20261118013517','20261118020743'];
const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')&&f>'20261118020743_rich_text_content.sql'&&f<='20261118125914_workflow_table_privileges.sql').sort();
if(files.length!==8)throw new Error('Daftar forward berubah; tinjau ulang plan sebelum membuat artefak.');
const sql=['-- REVIEW WAJIB: backup, schema diff, maintenance dan izin production terpisah.','begin;',`lock table supabase_migrations.schema_migrations in exclusive mode;`,`do $$ begin if (select array_agg(version::text order by version) from supabase_migrations.schema_migrations) is distinct from array[${expected.map(v=>`'${v}'`).join(',')}]::text[] then raise exception 'History berubah atau forward sudah diterapkan; jangan replay/repair otomatis.';end if;end $$;`];
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'docs/baselines/production-pr08-schema.json'),'utf8'));
const functions=snapshot.functions.map(f=>({schema:f.schema,name:f.name,args:f.args,hash:createHash('md5').update(f.definition.replace(/\s+/g,' ').trim()).digest('hex')}));
const checks=JSON.stringify(functions);if(checks.includes('$pr08schema$'))throw new Error('Delimiter schema bertabrakan');
sql.push(`do $guard$ declare x jsonb;actual text;begin for x in select * from jsonb_array_elements($pr08schema$${checks}$pr08schema$::jsonb) loop
 select md5(btrim(regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]+',' ','g'))) into actual from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=x->>'schema' and p.proname=x->>'name' and pg_get_function_identity_arguments(p.oid)=x->>'args';
 if actual is distinct from x->>'hash' then raise exception 'Definisi fungsi baseline berubah; baca ulang schema dan tinjau sebelum migrasi.';end if;end loop;end $guard$;`);
const protectedTables=['letters','letter_versions','number_counters','number_issuances','audit_logs'];
const projections=protectedTables.map(name=>{const t=snapshot.tables.find(t=>t.schema==='public'&&t.name===name);const cols=t.columns.map(c=>`'${c.name}',x."${c.name}"`).join(',');return {name,query:`select md5(coalesce(jsonb_agg(jsonb_build_object(${cols}) order by x.id)::text,'[]')) from public."${name}" x`};});
sql.push('lock table '+protectedTables.map(t=>`public."${t}"`).join(',')+' in share row exclusive mode;', 'create temporary table pr08_integrity(kind text,digest text) on commit drop;');
for(const p of projections)sql.push(`insert into pr08_integrity values('${p.name}',(${p.query}));`);
const manifest=[];
for(const file of files){const source=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');const version=file.slice(0,14),name=file.slice(15,-4);manifest.push({file,sha256:createHash('sha256').update(source).digest('hex')});const body=source.replace(/^\s*(begin|commit);\s*$/gmi,'');const tag='$pr08_'+version+'$';if(body.includes(tag))throw new Error('Delimiter SQL bertabrakan');sql.push(`-- ${file}`,body,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${tag}${body}${tag}]);`);}
sql.push('-- PR08_INTEGRITY_CHECK');
for(const p of projections)sql.push(`do $$ begin if (select digest from pr08_integrity where kind='${p.name}') is distinct from (${p.query}) then raise exception 'Integritas ${p.name} berubah; transaksi dibatalkan';end if;end $$;`);
sql.push('commit;');const out=process.argv[2];if(!out)throw new Error('Berikan path output SQL untuk ditinjau.');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,sql.join('\n'));fs.writeFileSync(out+'.manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(`Artefak ${files.length} migrasi dibuat; tidak dieksekusi.`);
