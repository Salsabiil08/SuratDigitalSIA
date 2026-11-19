'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {exportSources,type ExportVersion,type ExportFormat} from '@/domain/document-export';

export function DocumentDownloads({id,current,unsigned,signatureCount,fullVersionAccess}:{id:string;current:ExportVersion;unsigned?:ExportVersion;signatureCount:number;fullVersionAccess:boolean}){
  const sources=exportSources(current,unsigned,fullVersionAccess);
  const [kind,setKind]=useState<'signed'|'unsigned'>(sources.signed?'signed':'unsigned');
  const [format,setFormat]=useState<ExportFormat>(current.file_format as ExportFormat);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useRef(false),mounted=useRef(true),controller=useRef<AbortController>();
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;controller.current?.abort();};},[]);
  const selected=sources[kind];
  const availableKind=selected?kind:sources.signed?'signed':'unsigned';
  const source=sources[availableKind];
  async function download(){
    if(active.current||!source)return;
    active.current=true;setBusy(true);setError('');controller.current=new AbortController();
    try{
      const response=await fetch(`/api/letters/${id}/document?download=1${source.blank?'&blank=1':''}`,{cache:'no-store',signal:controller.current.signal});
      if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||'Dokumen belum dapat diunduh. Coba lagi.');}
      const expected=source.format==='PDF'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if(!response.headers.get('content-type')?.includes(expected))throw new Error('Format dokumen berubah. Perbarui status lalu coba lagi.');
      let blob=await response.blob();
      if(format!==source.format){const {convertDocument}=await import('@/lib/document-export');blob=await convertDocument(blob,source.format,format);}
      if(!mounted.current)return;
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
      a.download=`Surat-${signatureCount===0?'dokumen':availableKind==='signed'?'bertanda-tangan':'belum-bertanda-tangan'}.${format.toLowerCase()}`;
      document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Unduhan gagal. Coba lagi.');}
    finally{active.current=false;if(mounted.current)setBusy(false);}
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-3">
      {signatureCount>0&&<label className="text-sm space-y-1"><span className="block">Versi surat</span><select aria-label="Versi surat untuk diunduh" className="rounded-lg border p-2 bg-white" value={availableKind} disabled={busy} onChange={e=>setKind(e.target.value as typeof kind)}>
        <option value="signed" disabled={!sources.signed}>Bertanda tangan</option><option value="unsigned" disabled={!sources.unsigned}>Belum bertanda tangan</option>
      </select></label>}
      <label className="text-sm space-y-1"><span className="block">Format</span><select aria-label="Format unduhan surat" className="rounded-lg border p-2 bg-white" value={format} disabled={busy} onChange={e=>setFormat(e.target.value as ExportFormat)}><option value="PDF">PDF</option><option value="DOCX">DOCX</option></select></label>
      <Button type="button" variant="secondary" disabled={!source||busy} aria-busy={busy} onClick={download}>{busy?'Menyiapkan unduhan…':'Unduh Surat'}</Button>
    </div>
    {source&&source.format!==format&&<p className="text-xs text-neutral-500">{format==='PDF'?'PDF dibuat dari tampilan pratinjau.':'DOCX dari PDF berupa gambar per halaman.'}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
