import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {readLetter,hashBytes,DOCUMENT_BUCKET} from '@/server/letter-workflow';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;fileId:string}>}){
 try{await requireUser();const {id,fileId}=await params;await readLetter(id);
 const {data:f,error}=await (await createClient()).from('letter_attachments').select('file_name,storage_path,size_bytes,file_hash,storage_bucket').eq('id',fileId).eq('letter_id',id).single();
 if(error||!f)throw new Error();const {data,error:downloadError}=await createAdminClient().storage.from(f.storage_bucket||DOCUMENT_BUCKET).download(f.storage_path);if(downloadError||!data)throw new Error();
 const bytes=new Uint8Array(await data.arrayBuffer());if(bytes.length!==f.size_bytes||f.file_hash&&hashBytes(bytes)!==f.file_hash)throw new Error();
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Lampiran tidak dapat diakses atau belum tersedia.'},{status:403});}
}
