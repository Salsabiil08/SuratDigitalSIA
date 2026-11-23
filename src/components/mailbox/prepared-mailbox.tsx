import {RetryButton} from '@/components/ui/retry-button';
import {ActionNotice} from "@/components/ui/action-notice";
import React from 'react';
import Link from 'next/link';
import {MailboxFolder,mailboxQuery,mailboxHref} from '@/domain/mailbox';
import {readMailbox} from '@/server/mailbox';
import {MailboxClient} from './mailbox-client';
export async function PreparedMailbox({folder,searchParams}:{folder:MailboxFolder;searchParams:Record<string,string|string[]|undefined>}){
 const query=mailboxQuery(searchParams);
 try{const data=await readMailbox(folder,query);return <MailboxClient folder={folder} query={query} data={data}/>;}
 catch{return <div className="space-y-3"><ActionNotice>Kotak surat belum dapat ditampilkan. Silakan coba kembali.</ActionNotice><RetryButton label="Coba Kembali"/></div>;}
}
