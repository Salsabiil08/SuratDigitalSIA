'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';

export function RefreshStatusButton({refresh,disabled=false}: {refresh:()=>Promise<void>;disabled?:boolean}) {
  const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[failed,setFailed]=useState(false);
  async function run(){
    if(busy||disabled)return;
    setBusy(true);setFeedback('');setFailed(false);
    try{await refresh();setFeedback('Status surat sudah diperbarui.');}
    catch(e){setFailed(true);setFeedback(e instanceof Error?e.message:'Status belum dapat diperbarui. Coba lagi.');}
    finally{setBusy(false);}
  }
  return <div className="flex flex-col items-end gap-1">
    <Button type="button" variant="secondary" disabled={disabled||busy} aria-busy={busy} onClick={run}>
      {busy?'Memperbarui…':'Perbarui status'}
    </Button>
    {feedback&&<p role={failed?'alert':'status'} className={`text-xs max-w-xs text-right ${failed?'text-red-700':'text-neutral-600'}`}>{feedback}</p>}
  </div>;
}
