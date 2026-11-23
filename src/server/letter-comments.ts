import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import type {CommentContext} from '@/domain/letter-comments';
export async function readCommentContext(letterId:string):Promise<CommentContext>{
 await requireUser();const {data,error}=await (await createClient()).rpc('get_letter_comment_context',{p_letter:letterId});
 if(error||!data||!Array.isArray(data.items)||typeof data.canRead!=='boolean'||typeof data.canComment!=='boolean')throw new Error('Tanggapan surat belum dapat dimuat. Silakan coba kembali.');
 return data as CommentContext;
}
