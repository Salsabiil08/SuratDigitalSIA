import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertSameOrigin,hashBytes,storeBytes,DOCUMENT_BUCKET} from '@/server/letter-workflow';
import {inspectDocument} from '@/lib/letter-document';
import {revalidatePath} from 'next/cache';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 let path:string|undefined;
 try{
  assertSameOrigin(request);const user=await requireUser();const db=await createClient();const form=await request.formData();const file=form.get('file') as File|null;const key=String(form.get('key')||'');
  if(!/^[0-9a-f-]{36}$/i.test(key)||!file?.size||file.size>1048576||!/^.+\.(pdf|docx)$/i.test(file.name))throw new Error('Lampiran PDF/DOCX maksimal 1 MB dan kunci unggah yang sah wajib diisi.');
  const bytes=new Uint8Array(await file.arrayBuffer());const hash=hashBytes(bytes);
  const {data:d,error:de}=await db.from('dispositions').select('id,recipient_id,status,source_dispatch_id,revision').eq('id',(await params).id).single();
  if(de||!d||d.recipient_id!==user.id||!d.source_dispatch_id||!['NEW','IN_PROGRESS','REVISION_REQUESTED'].includes(d.status))throw new Error('Lampiran hanya dapat disiapkan pelaksana sebelum pemeriksaan.');
  const {data:old,error:oe}=await db.from('disposition_result_files').select('disposition_id,file_hash,size_bytes').eq('uploaded_by',user.id).eq('operation_key',key).maybeSingle();
  if(oe)throw new Error('Lampiran sebelumnya belum dapat diperiksa.');
  if(old){if(old.disposition_id!==(await params).id||old.file_hash!==hash||old.size_bytes!==file.size)throw new Error('Kunci unggah sudah dipakai untuk berkas lain.');return Response.json({success:true});}
  const format=file.name.toLowerCase().endsWith('.pdf')?'PDF':'DOCX';await inspectDocument(bytes,format);const doc=await storeBytes(user.id,bytes,format);path=doc.path;
  const {error}=await createAdminClient().rpc('disposition_workflow',{p_actor:user.id,p_action:'ATTACH',p_id:d.id,p_revision:d.revision,p_data:{operationKey:key,path:doc.path,hash:doc.hash,format,name:file.name,size:file.size}});
  if(error)throw new Error('Lampiran belum dapat dicatat. Perbarui tugas lalu coba kembali.');
  path=undefined;revalidatePath('/disposisi');return Response.json({success:true});
 }catch(e){if(path)await createAdminClient().storage.from(DOCUMENT_BUCKET).remove([path]);return Response.json({error:e instanceof Error?e.message:'Unggahan belum dapat disimpan.'},{status:400});}
}
