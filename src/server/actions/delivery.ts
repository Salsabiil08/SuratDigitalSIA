'use server';
import {requireUser} from '@/server/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {readLetter,downloadVersion} from '@/server/letter-workflow';
import {revalidatePath} from 'next/cache';
export async function sendInternalLetterAction(id:string,cc:string[]=[]){
 try{
  const user=await requireUser();const l=await readLetter(id);
  const doc=await downloadVersion(l,false);
  const {data,error}=await createAdminClient().rpc('dispatch_internal_letter',{p_actor:user.id,p_letter:id,p_version:doc.version.id,p_hash:doc.version.file_hash,p_key:`internal-send-${id}`,p_cc:cc});
  if(error)throw new Error(error.message);
  for(const p of [`/surat/${id}`,'/surat','/notifikasi'])revalidatePath(p);
  return{success:true,dispatchId:data as string};
 }catch(e){return{success:false,error:e instanceof Error?e.message:'Pengiriman belum dapat disimpan.'};}
}
export async function receiveInternalLetterAction(dispatchId:string){
 try{
  const user=await requireUser();
  const{error}=await createAdminClient().rpc('record_internal_recipient_action',{p_actor:user.id,p_dispatch:dispatchId,p_action:'RECEIVE'});
  if(error)throw new Error(error.message);
  revalidatePath('/surat');revalidatePath('/notifikasi');
  return{success:true};
 }catch(e){return{success:false,error:e instanceof Error?e.message:'Penerimaan belum dapat dicatat.'};}
}
