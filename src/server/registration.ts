import {createAdminClient} from '@/lib/supabase/admin';
export async function registrationOptions(){
 try{
  const db=createAdminClient();
  const [u,p]=await Promise.all([
   db.from('organizational_units').select('id,code,name').eq('is_active',true).order('name'),
   db.from('positions').select('id,code,name,level').eq('is_active',true).order('level'),
  ]);
  if(u.error||p.error)throw new Error('query');
  return {units:u.data||[],positions:p.data||[],error:''};
 }catch{return {units:[] as {id:string;code:string;name:string}[],positions:[] as {id:string;code:string;name:string;level:number}[],error:'Pilihan unit dan jabatan belum dapat dimuat. Coba kembali.'};}
}
