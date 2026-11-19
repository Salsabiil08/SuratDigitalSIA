import {fileURLToPath} from 'node:url';
export function verifyStaging(env){
 const errors=[];
 for(const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SIADOCS_STAGING_PROJECT_REF','VERCEL_PROJECT_ID'])if(!env[k])errors.push(`${k} belum diisi`);
 if(env.SIADOCS_ENV!=='staging'||env.NEXT_PUBLIC_SIADOCS_ENV!=='staging')errors.push('Label server dan browser harus staging');
 try{const u=new URL(env.NEXT_PUBLIC_SUPABASE_URL);if(u.hostname!==`${env.SIADOCS_STAGING_PROJECT_REF}.supabase.co`||u.protocol!=='https:'||env.SIADOCS_STAGING_PROJECT_REF==='ixrpdgkrxlsxbwttujvz')errors.push('URL harus milik project staging terpisah');}catch{errors.push('URL staging tidak valid');}
 if(env.VERCEL_PROJECT_ID==='prj_2MolQrrsOlzIjJgg3cZDphrv9O4u')errors.push('Gunakan project Vercel staging terpisah');
 return errors;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const errors=verifyStaging(process.env);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Konfigurasi isolasi staging PASS; koneksi/Auth/Storage belum diuji oleh pemeriksaan ini.');}
