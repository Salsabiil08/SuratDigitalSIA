'use client';
import {createContext,useCallback,useContext,useEffect,useId,useMemo,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
type Kind='error'|'success'|'info';
type Notice={id:string;kind:Kind;children:ReactNode};
const Context=createContext<{show:(notice:Notice)=>void;remove:(id:string)=>void}|null>(null);
function Popup({notice,remove}:{notice:Notice;remove:(id:string)=>void}){
  const [paused,setPaused]=useState(false);
  useEffect(()=>{if(notice.kind!=='success'||paused)return;const timer=window.setTimeout(()=>remove(notice.id),6000);return()=>window.clearTimeout(timer);},[notice,paused,remove]);
  const error=notice.kind==='error';
  return <div data-action-popup="true" role={error?'alert':'status'} aria-atomic="true" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)}
    className={`action-notice-popup rounded-xl border shadow-lg p-4 flex items-start gap-3 bg-white ${error?'border-red-300 text-red-800':notice.kind==='success'?'border-emerald-300 text-emerald-800':'border-amber-300 text-amber-900'}`} style={{pointerEvents:'auto'}}>
    <span aria-hidden="true" className="font-bold shrink-0">{error?'!':notice.kind==='success'?'✓':'i'}</span>
    <div className="min-w-0 flex-1 text-sm whitespace-pre-wrap break-words">{notice.children}</div>
    <button type="button" aria-label="Tutup pemberitahuan" onClick={()=>remove(notice.id)} className="shrink-0 rounded p-1 min-h-8 min-w-8 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-red">✕</button>
  </div>;
}
export function ActionNoticeProvider({children}:{children:ReactNode}){
  const [notices,setNotices]=useState<Notice[]>([]),[mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const show=useCallback((notice:Notice)=>setNotices(previous=>[...previous.filter(n=>n.id!==notice.id),notice].slice(-3)),[]);
  const remove=useCallback((id:string)=>setNotices(previous=>previous.filter(n=>n.id!==id)),[]);
  const context=useMemo(()=>({show,remove}),[show,remove]);
  return <Context.Provider value={context}>{children}{mounted&&createPortal(<div aria-label="Pemberitahuan aktivitas" style={{position:'fixed',top:'max(12px, env(safe-area-inset-top))',left:'50%',transform:'translateX(-50%)',width:'calc(100% - 24px)',maxWidth:'560px',zIndex:300,pointerEvents:'none',display:'grid',gap:'8px',maxHeight:'calc(100dvh - 24px)',overflowY:'auto'}}>{notices.map(n=><Popup key={n.id} notice={n} remove={remove}/>)}</div>,document.body)}</Context.Provider>;
}
export function ActionNotice({kind='error',children,eventKey}:{kind?:Kind;children:ReactNode;eventKey?:unknown}){
  const context=useContext(Context),id=useId();
  useEffect(()=>{if(!context)return;context.show({id,kind,children});return()=>context.remove(id);},[context,id,kind,children,eventKey]);
  // A safe inline fallback also keeps standalone server-rendered error pages readable.
  return context?null:<p role={kind==='error'?'alert':'status'}>{children}</p>;
}
