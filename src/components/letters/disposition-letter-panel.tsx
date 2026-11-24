import React from 'react';
import Link from 'next/link';
import {Card} from '@/components/ui/card';
import type {DispositionLetterContext} from '@/server/disposition-integration';
export function DispositionLetterPanel({letterId,context}:{letterId:string;context:DispositionLetterContext}){
 if(!context.canCreate&&!context.tasks.length&&!context.links.length)return null;
 return <details open={context.canCreate || undefined} className="rounded-xl border bg-white p-4 space-y-3"><summary className="cursor-pointer font-semibold">Disposisi dan surat tindak lanjut</summary>
 {context.canCreate&&<Link prefetch={false} className="inline-flex rounded-full bg-brand-red text-white px-4 py-2 text-sm" href={`/disposisi?surat=${encodeURIComponent(letterId)}`}>Buat Disposisi</Link>}

 {context.tasks.map(t=><p key={t.id} className="text-sm break-words"><Link prefetch={false} className="text-brand-red underline" href={`/disposisi?tugas=${encodeURIComponent(t.id)}`}>Buka Disposisi — {t.subject}</Link></p>)}
 {context.links.map(l=><p key={l.id} className="text-sm break-words"><Link prefetch={false} className="text-brand-red underline" href={`/surat/${encodeURIComponent(l.letterId)}`}>{context.tasks.some(t=>t.id===l.dispositionId&&t.isResult)?'Surat Asal Disposisi':'Surat Terkait Disposisi'}: {l.officialNumber||'Belum bernomor'} — {l.subject}</Link></p>)}
 </details>;
}
