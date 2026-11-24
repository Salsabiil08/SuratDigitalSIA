'use server';
import {requireUser} from '@/server/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {revalidatePath} from 'next/cache';
export async function reserveManualNumber(input:{type:string;subject:string;signer?:string;key:string}) {
 try {
  const user=await requireUser();
  if(!['IN','KRE','Tag'].includes(input.type)||!input.subject?.trim()||input.subject.trim().length>500||!/^[0-9a-f-]{36}$/i.test(input.key))throw new Error('Lengkapi jenis dan perihal surat.');
  const {data,error}=await createAdminClient().rpc('reserve_manual_letter_number',{p_actor:user.id,p_type:input.type,p_subject:input.subject.trim(),p_signer:input.type==='KRE'?input.signer||null:null,p_key:input.key});
  if(error)throw new Error(error.message);
  revalidatePath('/surat/ambil-nomor');return {success:true,id:data.id as string,number:data.official_number as string};
 }catch(e){return {success:false,error:e instanceof Error?e.message:'Nomor belum dapat diambil.'};}
}
