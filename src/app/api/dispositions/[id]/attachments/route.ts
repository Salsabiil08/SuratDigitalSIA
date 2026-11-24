import {storeAttachment,ATTACHMENT_BUCKET} from "@/server/attachments";
import {validateAttachment} from "@/domain/attachments";
import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertSameOrigin,hashBytes} from '@/server/letter-workflow';
import {revalidatePath} from 'next/cache';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 let path:string|undefined;
 try{
  assertSameOrigin(request);const user=await requireUser();const db=await createClient();const form=await request.formData();const file=form.get('file') as File|null;const key=String(form.get('key')||'');
  if(!/^[0-9a-f-]{36}$/i.test(key)||!file)throw new Error('Pilih lampiran dan gunakan kunci unggah yang sah.');validateAttachment(file);
  const bytes=new Uint8Array(await file.arrayBuffer());const hash=hashBytes(bytes);
  const {data:d,error:de}=await db.from('dispositions').select('id,recipient_id,status,source_dispatch_id,revision').eq('id',(await params).id).single();
  if(de||!d||d.recipient_id!==user.id||!d.source_dispatch_id||!['NEW','IN_PROGRESS','REVISION_REQUESTED'].includes(d.status))throw new Error('Lampiran hanya dapat disiapkan pelaksana sebelum pemeriksaan.');
  const {data:old,error:oe}=await db.from('disposition_result_files').select('disposition_id,file_hash,size_bytes').eq('uploaded_by',user.id).eq('operation_key',key).maybeSingle();
  if(oe)throw new Error('Lampiran sebelumnya belum dapat diperiksa.');
  if(old){if(old.disposition_id!==(await params).id||old.file_hash!==hash||old.size_bytes!==file.size)throw new Error('Kunci unggah sudah dipakai untuk berkas lain.');return Response.json({success:true});}
  const format='BINARY';const doc=await storeAttachment(user.id,file);path=doc.path;
  const {error}=await createAdminClient().rpc('disposition_workflow',{p_actor:user.id,p_action:'ATTACH',p_id:d.id,p_revision:d.revision,p_data:{operationKey:key,path:doc.path,hash:doc.hash,format,name:file.name,size:file.size}});
  if(error)throw new Error('Lampiran belum dapat dicatat. Perbarui tugas lalu coba kembali.');
  path=undefined;revalidatePath('/disposisi');return Response.json({success:true});
 }catch(e){if(path)await createAdminClient().storage.from(ATTACHMENT_BUCKET).remove([path]);return Response.json({error:e instanceof Error?e.message:'Unggahan belum dapat disimpan.'},{status:400});}
}
