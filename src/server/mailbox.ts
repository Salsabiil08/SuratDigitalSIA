import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {MailboxData,MailboxFolder,MailboxQuery} from '@/domain/mailbox';
/** Sesi pengguna/RLS, bukan admin client. Tidak menerima actor_id dari browser. */
export async function readMailbox(folder:MailboxFolder,query:MailboxQuery):Promise<MailboxData>{
 await requireUser();
 const db=await createClient();
 async function readPage(page:number){
  const {data,error}=await db.rpc('list_internal_mailbox',{p_folder:folder,p_filter:query.filter,p_query:query.q,p_page:page,p_size:10});
  if(error||!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0||!Number.isInteger(data.page)||data.page!==page||!Number.isInteger(data.pages)||data.pages<data.page||data.pageSize!==10||data.items.length>10||data.total<data.items.length)throw new Error('Kotak surat belum dapat diambil. Silakan coba kembali.');
  return data as MailboxData;
 }
 const first=await readPage(1);
 const items=[...first.items];
 for(let page=2;page<=first.pages;page++)items.push(...(await readPage(page)).items);
 const result:MailboxData={...first,items};
 if(result.items.length){
  for(let offset=0;offset<result.items.length;offset+=100){
  const batch=result.items.slice(offset,offset+100);
  const {data:summaries,error:ce}=await db.from('letter_comment_summaries').select('dispatch_id,author_id,commented_at').in('dispatch_id',batch.map(i=>i.dispatch_id));
  if(ce)throw new Error('Status tanggapan belum dapat dimuat. Silakan coba kembali.');
  for(const item of batch)for(const recipient of item.recipients){recipient.commented_at=(summaries||[]).find(s=>s.dispatch_id===item.dispatch_id&&s.author_id===recipient.profile_id)?.commented_at||null;}
  }
 }
 return result;
}
