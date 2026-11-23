import React from 'react';
import Link from 'next/link';
import {Card} from '@/components/ui/card';
import type {DispositionLetterContext} from '@/server/disposition-integration';
export function DispositionLetterPanel({letterId,context}:{letterId:string;context:DispositionLetterContext}){
 if(!context.canCreate&&!context.tasks.length&&!context.links.length)return null;
 return <Card className="p-5 space-y-3"><h2 className="font-bold">Disposisi dan Surat Tindak Lanjut</h2>
 {context.canCreate&&<Link prefetch={false} className="inline-flex rounded-full bg-brand-red text-white px-4 py-2 text-sm" href={`/disposisi?surat=${encodeURIComponent(letterId)}`}>Buat Disposisi</Link>}
 <p className="text-sm">Hasil diperiksa pemberi disposisi. Balasan resmi terkirim dan disposisi selesai adalah dua status yang berbeda.</p>
 {context.tasks.map(t=><p key={t.id} className="text-sm break-words"><Link prefetch={false} className="text-brand-red underline" href={`/disposisi?tugas=${encodeURIComponent(t.id)}`}>Buka Disposisi — {t.subject}</Link></p>)}
 {context.links.map(l=><p key={l.id} className="text-sm break-words"><Link prefetch={false} className="text-brand-red underline" href={`/surat/${encodeURIComponent(l.letterId)}`}>Surat Tindak Lanjut: {l.officialNumber||'Belum bernomor'} — {l.subject}</Link></p>)}
 </Card>;
}
