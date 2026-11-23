'use server';
import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {commentBody} from '@/domain/letter-comments';
import {readCommentContext} from '@/server/letter-comments';
import {revalidatePath} from 'next/cache';
export async function postLetterComment(letterId:string,body:string,key:string){
 try{await requireUser();const text=commentBody(body);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))throw new Error('Permintaan komentar tidak valid. Muat ulang halaman.');
 const {data,error}=await (await createClient()).rpc('add_letter_comment',{p_letter:letterId,p_body:text,p_key:key});if(error||!data)throw new Error('Komentar belum dapat dipastikan tersimpan. Periksa tanggapan sebelum mencoba kembali.');
 for(const path of [`/surat/${letterId}`,'/kotak-masuk','/kotak-keluar','/'])revalidatePath(path);
 return {success:true,id:data as string};
 }catch(e){return {success:false,error:e instanceof Error?e.message:'Komentar belum dapat dikirim.'};}
}
export async function getLetterComments(letterId:string){return readCommentContext(letterId);}
