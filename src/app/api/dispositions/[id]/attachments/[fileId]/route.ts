import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {hashBytes,DOCUMENT_BUCKET} from '@/server/letter-workflow';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;fileId:string}>}){
 try{
  await requireUser();const {data:f,error}=await (await createClient()).from('disposition_result_files').select('file_name,storage_path,file_hash,size_bytes,file_format,storage_bucket').eq('id',(await params).fileId).eq('disposition_id',(await params).id).single();
  if(error||!f)throw new Error('Lampiran tidak dapat diakses.');
  const {data,error:downloadError}=await createAdminClient().storage.from(f.storage_bucket||DOCUMENT_BUCKET).download(f.storage_path);if(downloadError||!data)throw new Error('Lampiran tidak tersedia.');
  const bytes=new Uint8Array(await data.arrayBuffer());if(bytes.length!==f.size_bytes||hashBytes(bytes)!==f.file_hash)throw new Error('Bukti berkas tidak sesuai.');
  return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Lampiran tidak dapat diakses atau belum tersedia.'},{status:403});}
}
