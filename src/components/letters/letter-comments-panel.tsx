'use client';
import {useEffect,useRef,useState} from 'react';
import type {CommentContext} from '@/domain/letter-comments';
import {postLetterComment,getLetterComments} from '@/server/actions/letter-comments';
import {Button} from '@/components/ui/button';
import {ActionNotice} from '@/components/ui/action-notice';
import {Card} from '@/components/ui/card';
import {mailboxDate} from '@/domain/mailbox';
export function LetterCommentsPanel({letterId,context,onChanged}:{letterId:string;context:CommentContext;onChanged?:()=>void}){
 const [data,setData]=useState(context),[open,setOpen]=useState(false),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');const lock=useRef(false);
 useEffect(()=>setData(context),[context]);
 if(!data.canRead || (!data.canComment && data.items.length===0))return null;
 async function refresh(){try{setData(await getLetterComments(letterId));setError('');}catch{setError('Tanggapan belum dapat dimuat. Silakan coba kembali.');}}
 async function send(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setSuccess('');
 try{const slot=`siadocs-comment-${letterId}`;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.trim())))).map(b=>b.toString(16).padStart(2,'0')).join('');let intent: {hash:string;key:string}|null=null;try{intent=JSON.parse(sessionStorage.getItem(slot)||'null');}catch{}
 if(!intent||intent.hash!==hash){intent={hash,key:crypto.randomUUID()};sessionStorage.setItem(slot,JSON.stringify(intent));}
 const result=await postLetterComment(letterId,body,intent.key);if(!result.success)throw new Error(result.error);
 sessionStorage.removeItem(slot);setBody('');setSuccess('Komentar berhasil dikirim.');onChanged?.();
 try{setData(await getLetterComments(letterId));}catch{setError('Komentar berhasil dikirim. Daftar tanggapan belum dapat diperbarui. Muat ulang halaman.');}
 }catch(e){setError(e instanceof Error?e.message:'Komentar belum dapat dikirim.');}finally{lock.current=false;setBusy(false);}}
 return <Card id="comments" className="p-5 space-y-3 scroll-mt-24"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Tanggapan</h2><Button variant="secondary" size="sm" onClick={refresh}>Muat Ulang Tanggapan</Button></div>
 {error&&<ActionNotice>{error}</ActionNotice>}{success&&<ActionNotice kind="success">{success}</ActionNotice>}
 {data.items.length===0?null:<ol className="space-y-3">{data.items.map(c=><li key={c.id} className="rounded-xl border p-3"><p className="text-sm font-semibold">{c.authorName}</p><time className="text-xs text-neutral-500" dateTime={c.createdAt}>{mailboxDate(c.createdAt)}</time><p className="whitespace-pre-wrap break-words text-sm mt-2">{c.body}</p></li>)}</ol>}
 {data.total>data.items.length&&<p className="text-xs text-neutral-500">Menampilkan {data.items.length} komentar terbaru.</p>}
 {data.canComment&&<><Button variant="secondary" onClick={()=>setOpen(x=>!x)}>{open?'Tutup Isian Komentar':'Balas dengan Komentar'}</Button>{open&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="letter-comment" className="block text-sm font-semibold">Komentar Anda</label><textarea id="letter-comment" value={body} onChange={e=>setBody(e.target.value)} required maxLength={5000} rows={4} className="w-full rounded-xl border p-3 text-sm"/><Button type="submit" disabledReason={!body.trim()?'Isi komentar terlebih dahulu.':undefined} isLoading={busy} loadingLabel="Mengirim komentar…">Kirim Komentar</Button></form>}</>}
</Card>;
}
