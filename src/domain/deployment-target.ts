export const PRODUCTION_SUPABASE_REF='ixrpdgkrxlsxbwttujvz';
/** Gagal tertutup bila build preview/staging menunjuk database production. */
export function assertSupabaseTarget(url:string,appEnv?:string,deploymentEnv?:string){
 if(appEnv!=='staging'&&deploymentEnv!=='preview')return;
 let host:string;try{host=new URL(url).hostname;}catch{throw new Error('Konfigurasi database staging belum valid.');}
 if(host===`${PRODUCTION_SUPABASE_REF}.supabase.co`)throw new Error('Staging/preview tidak boleh menggunakan database production.');
 if(!host)throw new Error('Database staging belum ditetapkan.');
}
