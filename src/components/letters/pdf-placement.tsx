'use client';
import {useEffect,useState} from 'react';
import type {SignatureArea} from '@/domain/workflow';
import {PdfCanvas,type PdfArea} from './pdf-canvas';
import {Button} from '@/components/ui/button';
export function PdfPlacement({omitNumber=false,file,url,numberArea,signatureAreas,signatureLabels,stampArea,stampEnabled,onStampEnabled,onPlace,onReset}:{omitNumber?:boolean;file:File|null;url?:string;numberArea?:SignatureArea;signatureAreas:SignatureArea[];signatureLabels:string[];stampArea?:SignatureArea;stampEnabled:boolean;onStampEnabled:(value:boolean)=>void;onPlace:(key:string,area:SignatureArea)=>void;onReset:()=>void}){
 const [blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[active,setActive]=useState('number'),[selecting,setSelecting]=useState(true);
 useEffect(()=>{const controller=new AbortController();let alive=true;setBlob(null);setError('');setActive('number');if(file){setBlob(file);return;}if(!url)return;
  void (async()=>{try{const res=await fetch(url,{cache:'no-store',signal:controller.signal});if(!res.ok)throw new Error();const bytes=await res.blob();if(alive)setBlob(bytes);}catch{if(alive)setError('PDF belum dapat dimuat. Coba kembali.');}})();return()=>{alive=false;controller.abort();};
 },[file,url,attempt]);
 const slots:PdfArea[]=[...(omitNumber?[]:[{key:'number',label:'Nomor Surat',area:numberArea,defaultSize:{width:220,height:24}}]),...signatureLabels.map((label,i)=>({key:`signature-${i}`,label,area:signatureAreas[i],defaultSize:{width:140,height:55}})),...(stampEnabled?[{key:'stamp',label:'Stempel',area:stampArea,defaultSize:{width:90,height:60}}]:[])];
 const current=slots.find(s=>s.key===active)||slots[0]!;
 function place(key:string,area:SignatureArea){onPlace(key,area);const index=slots.findIndex(s=>s.key===key);const next=slots.slice(index+1).find(s=>!s.area);if(next)setActive(next.key);}
 return <div className="space-y-3">
 <h2 className="font-bold">Pilih Posisi pada Surat</h2>
 <p className="text-sm text-neutral-600">Pilih bagian, lalu tarik kotak pada surat. Ketuk untuk menempatkan kotak dengan ukuran awal.</p>
 <div className="flex flex-wrap gap-2" aria-label="Bagian yang akan ditempatkan">{slots.map((slot,i)=><button type="button" key={slot.key} aria-pressed={selecting&&current.key===slot.key} disabled={i>0&&!slots[i-1]!.area} onClick={()=>{setActive(slot.key);setSelecting(true);}} className={`rounded-full border px-3 py-2 text-sm disabled:opacity-40 ${selecting&&current.key===slot.key?'bg-red-50 border-red-400 text-red-800':'bg-white'}`}>{slot.label}{slot.area?' ✓':''}</button>)}<button type="button" aria-pressed={!selecting} onClick={()=>setSelecting(false)} className={`rounded-full border px-3 py-2 text-sm ${!selecting?'bg-neutral-800 text-white':'bg-white'}`}>Geser Halaman</button></div>
 <p role="status" className="text-sm">{slots.filter(s=>s.area).length} dari {slots.length} area dipilih. {selecting?`Pilihan: ${current.label}.`:'Geser halaman, lalu pilih bagian untuk menempatkan kotak.'}</p>
 {signatureLabels.length>0&&<label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={stampEnabled} onChange={e=>onStampEnabled(e.target.checked)}/>Tambahkan tempat stempel (opsional)</label>}
 {error?<div role="alert" className="space-y-2"><p>{error}</p><Button type="button" variant="secondary" onClick={()=>setAttempt(n=>n+1)}>Muat Ulang PDF</Button></div>:blob?<div data-placement-scroll className="max-h-[75vh] overflow-auto rounded-xl bg-neutral-200 p-2 sm:p-4"><PdfCanvas blob={blob} areas={slots} activeKey={selecting?current.key:undefined} onPlace={place}/></div>:<p role="status">Menyiapkan PDF…</p>}
 {slots.some(s=>s.area)&&<Button type="button" variant="ghost" onClick={()=>{onReset();setActive('number');}}>Atur Ulang Posisi</Button>}
 </div>;
}
