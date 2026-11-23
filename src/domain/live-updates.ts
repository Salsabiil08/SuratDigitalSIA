/** Visible-tab polling only. Never queues concurrent refreshes or retries mutations. */
export function startLiveUpdates(options:{refresh:()=>Promise<void>;blocked:()=>boolean;onError:()=>void;poll:boolean},env:{window:Window;document:Document;navigator:Pick<Navigator,'onLine'>}){
  let disposed=false,inFlight=false;
  const sync=async()=>{
    if(disposed||inFlight||options.blocked()||env.document.visibilityState!=='visible'||!env.navigator.onLine)return;
    inFlight=true;
    try{await options.refresh();}catch{if(!disposed)options.onError();}finally{inFlight=false;}
  };
  const timer=options.poll?env.window.setInterval(()=>void sync(),15000):undefined;
  env.window.addEventListener('focus',sync);env.window.addEventListener('online',sync);env.document.addEventListener('visibilitychange',sync);
  return ()=>{disposed=true;if(timer!==undefined)env.window.clearInterval(timer);env.window.removeEventListener('focus',sync);env.window.removeEventListener('online',sync);env.document.removeEventListener('visibilitychange',sync);};
}
