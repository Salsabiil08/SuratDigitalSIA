'use client';
import React,{useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {MailboxFolder,MailboxData,MailboxQuery,MAILBOX_FILTERS,MailboxFilter,mailboxHref,mailboxPath,mailboxDate,recipientSummary} from '@/domain/mailbox';
import {receiveInternalLetterAction} from '@/server/actions/delivery';
import {PageHeader} from '@/components/ui/page-header';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
export function MailboxClient({folder,data,query}:{folder:MailboxFolder;data:MailboxData;query:MailboxQuery}){
 const router=useRouter();const[busy,setBusy]=useState<string|null>(null);const[error,setError]=useState('');const[message,setMessage]=useState('');
 const title=folder==='INBOX'?'Kotak Masuk':'Kotak Keluar';const base=mailboxPath(folder);const current={...query,page:data.page,pageSize:data.pageSize};
 useEffect(()=>{try{if(sessionStorage.getItem('siadocs-mailbox-refresh')===base){sessionStorage.removeItem('siadocs-mailbox-refresh');router.refresh();}}catch{}const refresh=()=>{if(document.visibilityState==='visible')router.refresh();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[router,base]);
 async function receive(id:string){setBusy(id);setError('');setMessage('');try{const r=await receiveInternalLetterAction(id);if(!r.success)throw new Error(r.error);setMessage('Penerimaan Anda telah dicatat.');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Penerimaan belum dapat dicatat.');}finally{setBusy(null);}}
 return <div className="max-w-6xl w-full space-y-4">
  <PageHeader title={title} actions={<Button variant="secondary" onClick={()=>router.refresh()}>Perbarui</Button>}/>
  <p className="text-sm text-neutral-600">{folder==='INBOX'?'Hanya surat yang telah dikirim resmi kepada Anda. Membuka atau mengunduh tidak otomatis mengonfirmasi penerimaan.':'Pengiriman resmi sesuai kewenangan Anda. Status setiap penerima dicatat terpisah; terkirim bukan berarti diterima.'}</p>
  <div className="flex gap-2 flex-wrap"><Link prefetch={false} href={folder==='INBOX'?'/kotak-keluar':'/kotak-masuk'} className="text-sm text-brand-red underline">{folder==='INBOX'?'Buka Kotak Keluar':'Buka Kotak Masuk'}</Link><Link href="/surat" className="text-sm text-brand-red underline">Surat Saya — draf dan proses surat</Link></div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
  <form action={base} method="get" className="flex flex-col sm:flex-row gap-3 sm:items-end">
   <input type="hidden" name="filter" value={query.filter}/>
   <label className="text-sm flex-1">Cari perihal, nomor atau pengirim<input name="q" defaultValue={query.q} maxLength={100} className="block w-full border rounded-xl px-3 py-2 mt-1"/></label>
   <label className="text-sm">Jumlah per halaman<select name="size" defaultValue={data.pageSize} className="block border rounded-xl px-3 py-2 mt-1">{[10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <Button type="submit">Cari</Button>
  </form>
  <nav aria-label="Filter kotak surat" className="flex gap-2 flex-wrap">{Object.entries(MAILBOX_FILTERS).map(([key,label])=><Link key={key} prefetch={false} aria-current={query.filter===key?'page':undefined} href={mailboxHref(folder,{...current,filter:key as MailboxFilter,page:1})} className={`rounded-full border px-3 py-2 text-sm ${query.filter===key?'bg-red-50 border-red-300 text-brand-red':'bg-white text-neutral-700'}`}>{label}</Link>)}</nav>
  <p className="text-xs text-neutral-600">{data.total} surat sesuai pencarian dan filter. Filter penerimaan hanya menghitung penerima utama; CC tidak memerlukan konfirmasi penerimaan utama.</p>
  {data.items.length===0?<Card className="p-6 text-sm text-neutral-600">{query.q||query.filter!=='ALL'?'Tidak ada surat yang sesuai pencarian atau filter ini.':'Belum ada surat resmi di '+title.toLowerCase()+'.'}</Card>:<div className="space-y-3">{data.items.map(item=>{
   const summary=recipientSummary(item.recipients);
   return <Card key={item.dispatch_id} className="p-4 sm:p-5 space-y-3">
    <div className="flex flex-col sm:flex-row sm:justify-between gap-2"><div className="min-w-0"><h2 className="font-bold break-words">{item.subject}</h2><p className="text-sm font-mono break-all">{item.official_number}</p><p className="text-sm text-neutral-600">Pengirim: {item.sender_name}</p></div><Link prefetch={false} className="text-brand-red underline text-sm shrink-0" onClick={()=>{try{sessionStorage.setItem('siadocs-mailbox-refresh',base);}catch{}}} href={`/surat/${encodeURIComponent(item.letter_id)}?asal=${base.slice(1)}`}>Buka Surat</Link></div>
    {item.letter_status==='CANCELLED'&&<p className="text-sm text-red-700">Surat dibatalkan; riwayat pengiriman tetap tersimpan.</p>}
    <dl className="grid sm:grid-cols-2 gap-2 text-sm"><div><dt className="text-neutral-500">Dokumen final</dt><dd>{mailboxDate(item.finalized_at)||'Belum tercatat'}</dd></div><div><dt className="text-neutral-500">Terkirim</dt><dd>{mailboxDate(item.sent_at)}</dd></div></dl>
    {folder==='OUTBOX'&&<p className="text-xs text-neutral-600">{summary.total} penerima · {summary.read} membuka · penerimaan utama {summary.received}/{summary.primary} · {summary.cc} tembusan</p>}
    <div className="grid gap-3 md:grid-cols-2">{item.recipients.map(r=><div key={r.profile_id} className="border rounded-xl p-3 text-sm space-y-1"><p className="font-semibold break-words">{r.name} — {r.role==='PRIMARY'?'Penerima utama':'Tembusan (CC)'}</p><p>Dibaca: {mailboxDate(r.read_at)||'Belum dibaca'}</p><p>Diterima: {r.role==='CC'?'Salinan; tanpa konfirmasi penerimaan utama':mailboxDate(r.received_at)||'Belum dikonfirmasi'}</p>{r.role==='CC'&&<p className="text-xs text-neutral-600">Tidak otomatis wajib membalas.</p>}{folder==='INBOX'&&r.role==='PRIMARY'&&!r.received_at&&<Button variant="secondary" isLoading={busy===item.dispatch_id} disabled={busy!==null} onClick={()=>receive(item.dispatch_id)}>Konfirmasi Terima Surat</Button>}</div>)}</div>
   </Card>;
  })}</div>}
  <nav aria-label="Halaman kotak surat" className="flex flex-wrap items-center justify-between gap-3 text-sm">
   {data.page>1?<Link prefetch={false} href={mailboxHref(folder,{...current,page:data.page-1})} className="text-brand-red underline">Sebelumnya</Link>:<span className="text-neutral-400">Sebelumnya</span>}
   <span>Halaman {data.page} dari {data.pages}</span>
   {data.page<data.pages?<Link prefetch={false} href={mailboxHref(folder,{...current,page:data.page+1})} className="text-brand-red underline">Berikutnya</Link>:<span className="text-neutral-400">Berikutnya</span>}
  </nav>
 </div>;
}
