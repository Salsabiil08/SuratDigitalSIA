import React from 'react';
import Link from 'next/link';
import {MailboxFolder,mailboxQuery,mailboxHref} from '@/domain/mailbox';
import {readMailbox} from '@/server/mailbox';
import {MailboxClient} from './mailbox-client';
export async function PreparedMailbox({folder,searchParams}:{folder:MailboxFolder;searchParams:Record<string,string|string[]|undefined>}){
 const query=mailboxQuery(searchParams);
 try{const data=await readMailbox(folder,query);return <MailboxClient folder={folder} query={query} data={data}/>;}
 catch{return <div className="space-y-3"><p role="alert" className="text-sm text-red-700">Kotak surat belum dapat ditampilkan. Silakan coba kembali.</p><Link prefetch={false} href={mailboxHref(folder,query)} className="text-brand-red underline text-sm">Coba Kembali</Link></div>;}
}
