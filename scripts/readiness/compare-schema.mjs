import fs from 'node:fs';
const [prodPath,localPath,outPath]=process.argv.slice(2);const prod=JSON.parse(fs.readFileSync(prodPath,'utf8'));const local=JSON.parse(fs.readFileSync(localPath,'utf8'));
const norm=v=>JSON.stringify(v,(_k,x)=>typeof x==='string'?x.replace(/\s+/g,' ').trim():x);
const rules={tables:{key:['schema','name'],fields:['columns','constraints','rls']},functions:{key:['schema','name','args'],fields:['definition','security_definer']},triggers:{key:['schema','table','name'],fields:['definition']},policies:{key:['schemaname','tablename','policyname'],fields:['cmd','roles','qual','with_check']}};
const result={structural:'PASS',differences:[],formattingOnlyFunctions:0,aclDifferences:[],counts:{}};
for(const [kind,{key,fields}] of Object.entries(rules)){
 const id=x=>key.map(k=>x[k]).join('|');const a=new Map(prod[kind].map(x=>[id(x),x]));const b=new Map(local[kind].filter(x=>!(kind==='policies'&&x.policyname==='test_broad_storage_read')).map(x=>[id(x),x]));result.counts[kind]={production:a.size,baseline:b.size};
 for(const k of new Set([...a.keys(),...b.keys()])){if(!a.has(k)||!b.has(k)){result.differences.push(`${kind}:${k}:missing`);continue;}for(const field of fields)if(norm(a.get(k)[field])!==norm(b.get(k)[field]))result.differences.push(`${kind}:${k}:${field}`);
 if(kind==='functions'&&a.get(k).definition!==b.get(k).definition&&norm(a.get(k).definition)===norm(b.get(k).definition))result.formattingOnlyFunctions++;
 if(a.get(k).acl!==b.get(k).acl)result.aclDifferences.push(`${kind}:${k}`);
 }
}
if(result.differences.length)result.structural='FAIL';result.aclNote='Managed Supabase defaults berbeda dari PostgreSQL biasa. PR-08 mencabut DML/TRUNCATE workflow; uji forward dimulai dengan grant luas serupa production.';
fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({structural:result.structural,counts:result.counts,aclDifferences:result.aclDifferences.length,formattingOnlyFunctions:result.formattingOnlyFunctions}));if(result.structural!=='PASS')process.exitCode=1;
