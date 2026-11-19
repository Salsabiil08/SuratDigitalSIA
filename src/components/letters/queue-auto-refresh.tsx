'use client';
import {useEffect,useTransition} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export function QueueAutoRefresh(){
  const router=useRouter(),path=usePathname(),[pending,startTransition]=useTransition();
  useEffect(()=>{
    if(!['/persetujuan','/pemeriksaan','/pengesahan'].includes(path))return;
    const refresh=()=>{if(!pending&&navigator.onLine&&document.visibilityState==='visible')startTransition(()=>router.refresh());};
    const timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
  },[router,path,pending]);
  return null;
}
