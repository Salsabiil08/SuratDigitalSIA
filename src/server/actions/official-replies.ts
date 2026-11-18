'use server';
import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {saveDraft} from '@/server/letter-workflow';
import {readReplyContext} from '@/server/official-replies';
import {replyDraft} from '@/domain/official-replies';
import {revalidatePath} from 'next/cache';
export async function createOfficialReplyAction(letterId:string,key:string){
 try{
  const user=await requireUser();
  const context=await readReplyContext(letterId);
  if(!context.seed)throw new Error('Balasan resmi hanya dapat dibuat penerima utama surat yang telah dikirim.');
  const input=replyDraft(context.seed,key);
  // Retry biasa tidak menghasilkan unggahan baru. RPC tetap mengunci dan memeriksa retry bersamaan.
  const {data:existing,error}=await createClient().from('official_reply_links').select('origin_dispatch_id,reply_letter_id').eq('created_by',user.id).eq('idempotency_key',key).maybeSingle();
  if(error)throw new Error('Draf balasan belum dapat diperiksa.');
  if(existing&&existing.origin_dispatch_id!==context.seed.dispatchId)throw new Error('Kunci balasan telah dipakai untuk surat lain.');
  const id=existing?.reply_letter_id||await saveDraft(input);
  revalidatePath('/surat');revalidatePath(`/surat/${letterId}`);
  return{success:true,id:id as string};
 }catch(e){return{success:false,error:e instanceof Error?e.message:'Draf balasan belum dapat dibuat.'};}
}
