import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import type {ReplyContext} from '@/domain/official-replies';
export async function readReplyContext(letterId:string):Promise<ReplyContext>{
 await requireUser();
 const {data,error}=await (await createClient()).rpc('get_official_reply_context',{p_letter:letterId});
 if(error||!data||!Array.isArray(data.links)||!Array.isArray(data.recipients)||!Object.hasOwn(data,'seed'))throw new Error('Hubungan surat belum dapat diambil. Silakan coba kembali.');
 return data as ReplyContext;
}
