'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {SignatureArea} from '@/domain/workflow';
import {placementFromDrag} from '@/domain/pdf-placement';
import {Button} from '@/components/ui/button';
export type PdfArea={key:string;label:string;area?:SignatureArea;defaultSize:{width:number;height:number}};
let pdfModule:Promise<typeof import('pdfjs-dist')>|undefined;
function pdfJs(){return pdfModule??=import('pdfjs-dist').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();return pdf;});}
export function PdfCanvas({blob,areas=[],activeKey,onPlace,onLoaded}:{blob:Blob;areas?:PdfArea[];activeKey?:string;onPlace?:(key:string,area:SignatureArea)=>void;onLoaded?:()=>void}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const loaded=useRef(false),onLoadedRef=useRef(onLoaded);onLoadedRef.current=onLoaded;
 useEffect(()=>{let alive=true;let task:ReturnType<typeof import('pdfjs-dist').getDocument>|undefined;setPdf(null);setError('');loaded.current=false;
  void (async()=>{try{const module=await pdfJs();if(!alive)return;const data=new Uint8Array(await blob.arrayBuffer());if(!alive)return;task=module.getDocument({data,useSystemFonts:true,enableXfa:false});const document=await task.promise;if(!alive)return;if(document.numPages>200)throw new Error('Dokumen terlalu panjang untuk pratinjau. Gunakan berkas dengan maksimal 200 halaman.');setPdf(document);}catch(e){if(alive)setError(e instanceof Error&&e.message.includes('200 halaman')?e.message:'Pratinjau PDF belum dapat ditampilkan. Coba muat ulang atau periksa berkas PDF.');}})();
  return()=>{alive=false;void task?.destroy().catch(()=>{});};
 },[blob,attempt]);
 const reportLoaded=()=>{if(!loaded.current){loaded.current=true;onLoadedRef.current?.();}};
 return <div className="space-y-3">
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-white p-4 space-y-3"><p>{error}</p><Button type="button" variant="secondary" onClick={()=>setAttempt(n=>n+1)}>Muat Ulang PDF</Button></div>:!pdf?<p role="status" className="p-4 text-sm text-neutral-600">Menyiapkan halaman PDF…</p>:Array.from({length:pdf.numPages},(_,i)=><PdfPage key={i} pdf={pdf} pageNumber={i+1} areas={areas} active={areas.find(a=>a.key===activeKey)} onPlace={onPlace} onLoaded={reportLoaded} onError={()=>setError('Halaman PDF gagal ditampilkan. Coba muat ulang pratinjau.')}/>)}
 </div>;
}
function PdfPage({pdf,pageNumber,areas,active,onPlace,onLoaded,onError}:{pdf:PDFDocumentProxy;pageNumber:number;areas:PdfArea[];active?:PdfArea;onPlace?:(key:string,area:SignatureArea)=>void;onLoaded:()=>void;onError:()=>void}){
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),drag=useRef<{x:number;y:number}|null>(null);
 const [near,setNear]=useState(pageNumber===1),[size,setSize]=useState({width:595.28,height:841.89}),[ready,setReady]=useState(false),[draft,setDraft]=useState<SignatureArea|null>(null),[displayWidth,setDisplayWidth]=useState(0);
 const callbacks=useRef({onLoaded,onError});callbacks.current={onLoaded,onError};
 useEffect(()=>{if(!root.current)return;if(!('IntersectionObserver' in window)){setNear(true);return;}const observer=new IntersectionObserver(entries=>setNear(entries.some(e=>e.isIntersecting)),{rootMargin:'300px'});observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!root.current)return;const update=()=>setDisplayWidth(Math.round(root.current!.clientWidth));update();if(!('ResizeObserver' in window))return;const observer=new ResizeObserver(update);observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!near||!displayWidth){if(canvas.current){canvas.current.width=0;canvas.current.height=0;}setReady(false);return;}let alive=true;let render:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;
  void (async()=>{try{const page=await pdf.getPage(pageNumber);if(!alive||!canvas.current)return;const pointView=page.getViewport({scale:1,rotation:0});setSize({width:pointView.width,height:pointView.height});const scale=Math.min(2,1600/pointView.width,displayWidth*(window.devicePixelRatio||1)/pointView.width);const viewport=page.getViewport({scale,rotation:0});canvas.current.width=Math.ceil(viewport.width);canvas.current.height=Math.ceil(viewport.height);render=page.render({canvas:canvas.current,viewport});await render.promise;if(alive){setReady(true);callbacks.current.onLoaded();}}catch(e){if(alive&&(e as Error)?.name!=='RenderingCancelledException')callbacks.current.onError();}})();
  return()=>{alive=false;render?.cancel();};
 },[pdf,pageNumber,near,displayWidth]);
 function point(event:React.PointerEvent<HTMLDivElement>){const bounds=event.currentTarget.getBoundingClientRect();return{x:(event.clientX-bounds.left)/bounds.width*size.width,y:(event.clientY-bounds.top)/bounds.height*size.height};}
 function place(start:{x:number;y:number},end:{x:number;y:number}){if(active)onPlace?.(active.key,placementFromDrag(pageNumber,size,start,end,active.defaultSize));}
 return <div className="space-y-1"><p className="text-xs text-neutral-500">Halaman {pageNumber}</p><div ref={root} className="relative bg-white shadow-sm w-full" style={{aspectRatio:`${size.width}/${size.height}`}}>
 <canvas ref={canvas} className="block w-full h-full" aria-label={`Pratinjau PDF halaman ${pageNumber}`}/>
 {!ready&&<span role="status" className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 bg-white">Memuat halaman…</span>}
 <div className={`absolute inset-0 ${active&&ready?'cursor-crosshair touch-none':''}`} role={active?'button':undefined} tabIndex={active?0:undefined} aria-label={active?`Tempatkan ${active.label} pada halaman ${pageNumber}`:undefined}
 onPointerDown={event=>{if(!active||!ready)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current=point(event);}}
 onPointerMove={event=>{if(active&&drag.current)setDraft(placementFromDrag(pageNumber,size,drag.current,point(event),active.defaultSize));}}
 onPointerUp={event=>{if(drag.current&&active){place(drag.current,point(event));drag.current=null;setDraft(null);event.currentTarget.releasePointerCapture(event.pointerId);}}}
 onPointerCancel={()=>{drag.current=null;setDraft(null);}}
 onKeyDown={event=>{if(!active||!ready)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();place({x:size.width/2,y:size.height/2},{x:size.width/2,y:size.height/2});}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&active.area?.page===pageNumber){event.preventDefault();const step=event.shiftKey?10:2;const old=active.area;const x=Math.max(0,Math.min(size.width-old.width,old.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0)));const y=Math.max(0,Math.min(size.height-old.height,old.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)));onPlace?.(active.key,{...old,x,y});}}}>
 {areas.filter(a=>a.area?.page===pageNumber).map(a=><AreaBox key={a.key} area={a.area!} label={a.label} size={size} selected={a.key===active?.key}/>)}
 {draft&&<AreaBox area={draft} label={active?.label||''} size={size} selected/>}
 </div></div></div>;
}
function AreaBox({area,label,size,selected}:{area:SignatureArea;label:string;size:{width:number;height:number};selected:boolean}){return <div data-pdf-area={label} className={`absolute border-2 pointer-events-none ${selected?'border-red-600 bg-red-100/40':'border-blue-600 bg-blue-100/30'}`} style={{left:`${area.x/size.width*100}%`,top:`${area.y/size.height*100}%`,width:`${area.width/size.width*100}%`,height:`${area.height/size.height*100}%`}}><span className="absolute bottom-full left-0 text-[10px] bg-white px-1 whitespace-nowrap text-neutral-900">{label}</span></div>;}
