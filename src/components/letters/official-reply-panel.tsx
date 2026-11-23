'use client';
import {ActionNotice} from "@/components/ui/action-notice";
import React,{useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {ReplyContext} from '@/domain/official-replies';
import {createOfficialReplyAction} from '@/server/actions/official-replies';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {mailboxDate} from '@/domain/mailbox';
export function OfficialReplyPanel({letterId,context}:{letterId:string;context:ReplyContext}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function create(){
  setBusy(true);setError('');
  try{
   const storageKey=`siadocs-reply-intent-${letterId}`;
   let key=sessionStorage.getItem(storageKey);if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,key);}
   const result=await createOfficialReplyAction(letterId,key);
   if(!result.success||!result.id)throw new Error(result.error||'Draf belum dapat dibuat.');
   sessionStorage.removeItem(storageKey);router.push(`/surat/${encodeURIComponent(result.id)}/edit`);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Balasan belum dapat dibuat.');}finally{setBusy(false);}
 }
 if(!context.seed&&!context.links.length)return null;
 return <Card className="p-5 space-y-3">
  <h2 className="font-bold">Balasan dengan Surat Resmi (Opsional)</h2>
  {error&&<ActionNotice>{error}</ActionNotice>}
  {context.seed&&<><p className="text-sm">Jika diperlukan, balasan resmi menggunakan surat dan nomor baru. Kategori awal mengikuti surat asal; periksa sebelum mengajukan.</p><Button onClick={create} isLoading={busy}>Balas dengan Surat Resmi</Button></>}

  {context.links.length===0?null:<ul className="space-y-3">{context.links.map(link=><li key={link.id} className="border rounded-xl p-3 text-sm break-words">
   <p className="font-semibold">{link.direction==='ORIGIN'?'Surat asal':'Surat balasan'}: {link.subject}</p>
   <p>Nomor: {link.officialNumber||'Belum diterbitkan'} · Identitas: {link.letterId}</p>
   <p>Hubungan dibuat oleh {link.actorName} pada {mailboxDate(link.createdAt)}</p>
   <p>{link.direction==='ORIGIN'?'Balasan ini':'Balasan'}: {link.sentAt?`Sudah dikirim pada ${mailboxDate(link.sentAt)}`:'Belum dikirim; belum tercatat sebagai balasan terkirim'}</p>
   <Link prefetch={false} className="text-brand-red underline" href={`/surat/${encodeURIComponent(link.letterId)}`}>Buka {link.direction==='ORIGIN'?'Surat Asal':'Surat Balasan'}</Link>
  </li>)}</ul>}
 </Card>;
}
