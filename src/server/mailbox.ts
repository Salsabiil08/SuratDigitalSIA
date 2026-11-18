import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
import {MailboxData,MailboxFolder,MailboxQuery} from '@/domain/mailbox';
/** Sesi pengguna/RLS, bukan admin client. Tidak menerima actor_id dari browser. */
export async function readMailbox(folder:MailboxFolder,query:MailboxQuery):Promise<MailboxData>{
 await requireUser();
 const {data,error}=await (await createClient()).rpc('list_internal_mailbox',{p_folder:folder,p_filter:query.filter,p_query:query.q,p_page:query.page,p_size:query.pageSize});
 if(error||!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0||!Number.isInteger(data.page)||data.page<1||!Number.isInteger(data.pages)||data.pages<data.page||![10,20,50].includes(data.pageSize)||data.items.length>data.pageSize||data.total<data.items.length)throw new Error('Kotak surat belum dapat diambil. Silakan coba kembali.');
 return data as MailboxData;
}
