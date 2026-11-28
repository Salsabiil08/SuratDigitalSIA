'use client';

import { useState } from 'react';
import { DocumentPreview } from '@/components/letters/document-preview';
import { MasterDialog, MasterStatus, MasterTable, type SaveMaster } from '@/components/master/management';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';

export type LetterheadVersion={id:string;type:string;version:number;is_active:boolean;fileName:string|null;uploadedAt:string|null;uploadedBy:string|null};
type Bank={id:string;code:string|null;name:string;is_active:boolean};
const types=[
  {id:'IN',label:'Surat Internal'},
  {id:'KRE',label:'Surat Eksternal'},
  {id:'Tag',label:'Surat Pengantar Tagihan'},
];
const dateTime=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'});
const url=(row:LetterheadVersion)=>`/api/admin/kop/${row.id}`;
const file=(row:LetterheadVersion)=>row.fileName||`Kop-Surat-v${row.version}.docx (nama unduhan)`;

function Metadata({row}:{row:LetterheadVersion}) {
  return <dl className="grid gap-2 text-sm">
    <div><dt className="text-xs text-neutral-600">Berkas DOCX</dt><dd className="break-all font-medium">{file(row)}</dd></div>
    <div><dt className="text-xs text-neutral-600">Tanggal unggah</dt><dd>{row.uploadedAt?`${dateTime.format(new Date(row.uploadedAt))} WIB`:'Tidak tercatat'}</dd></div>
    <div><dt className="text-xs text-neutral-600">Pengunggah</dt><dd>{row.uploadedBy||'Tidak tercatat'}</dd></div>
  </dl>;
}

type KopDialog={kind:'upload'|'history';type:string}|{kind:'preview';row:LetterheadVersion};

export function MasterLetterManagement({versions,banks,publish,saveBank}:{
  versions:LetterheadVersion[];banks:Bank[];publish:SaveMaster;saveBank:SaveMaster;
}) {
  const [tab,setTab]=useState('kop');
  const [dialog,setDialog]=useState<KopDialog|null>(null);
  const [bank,setBank]=useState<Bank|'new'|null>(null);
  const selectedType=dialog && 'type' in dialog ? types.find(type=>type.id===dialog.type) : undefined;

  return <>
    <Tabs tabs={[{id:'kop',label:'Kop Surat'},{id:'bank',label:'Master Bank'}]} activeTab={tab} onChange={setTab}/>
    {tab==='kop' ? <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {types.map(type=>{
        const active=versions.find(row=>row.type===type.id&&row.is_active);
        const hasHistory=versions.some(row=>row.type===type.id);
        return <Card key={type.id} className="flex min-w-0 flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-bold">{type.label}</h2>
            {active&&<MasterStatus active/>}
          </div>
          {active ? <>
            <DocumentPreview url={url(active)+'?preview=1'} format="DOCX" compact/>
            <p className="text-sm font-semibold">Versi {active.version}</p>
            <Metadata row={active}/>
          </> : <div className="flex min-h-36 flex-col justify-center rounded-xl border border-dashed p-4 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-800">Belum ada kop aktif</p>
            <p>Unggah berkas DOCX untuk jenis surat ini.</p>
          </div>}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={()=>setDialog({kind:'upload',type:type.id})}>{active?'Ganti Kop':'Unggah Kop'}</Button>
            {active&&<>
              <Button size="sm" variant="secondary" onClick={()=>setDialog({kind:'preview',row:active})}>Lihat Pratinjau</Button>
              <a href={url(active)} className="rounded-lg px-2 py-2 text-sm font-semibold text-brand-red underline">Unduh</a>
            </>}
            {hasHistory&&<Button size="sm" variant="ghost" onClick={()=>setDialog({kind:'history',type:type.id})}>Riwayat Versi</Button>}
          </div>
        </Card>;
      })}
    </div> : <MasterTable rows={banks} numbered columns={[
      {label:'Kode Bank',value:row=>row.code||'—'},
      {label:'Nama Bank',value:row=>row.name},
    ]} searchText={row=>`${row.code||''} ${row.name}`} searchLabel="Cari kode atau nama bank"
      addLabel="Tambah Bank" onAdd={()=>setBank('new')} onEdit={setBank}/>}
    {dialog?.kind==='upload'&&<MasterDialog title={`Unggah kop · ${selectedType?.label}`} close={()=>setDialog(null)} save={publish} submit="Unggah dan Aktifkan">
      <input type="hidden" name="jenis" value={dialog.type}/>
      <Field label="Berkas kop DOCX" htmlFor="new-letterhead" required hint="Maksimal 3 MB. Letakkan kop di bagian header Word.">
        <Input id="new-letterhead" name="kop" type="file" accept=".docx" required/>
      </Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1"/>
        <span>Aktifkan kop ini untuk surat baru. Versi sebelumnya tetap tersedia dalam riwayat.</span>
      </label>
    </MasterDialog>}
    {dialog?.kind==='preview'&&<MasterDialog title={`Pratinjau kop · Versi ${dialog.row.version}`} close={()=>setDialog(null)}>
      <DocumentPreview url={url(dialog.row)+'?preview=1'} format="DOCX"/>
    </MasterDialog>}
    {dialog?.kind==='history'&&<MasterDialog title={`Riwayat versi · ${selectedType?.label}`} close={()=>setDialog(null)}>
      <ul className="space-y-3">{versions.filter(row=>row.type===dialog.type).map(row=><li key={row.id} className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2"><p className="font-semibold">Versi {row.version}</p><MasterStatus active={row.is_active}/></div>
        <Metadata row={row}/>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={()=>setDialog({kind:'preview',row})}>Lihat Pratinjau</Button>
          <a className="text-sm font-semibold text-brand-red underline" href={url(row)}>Unduh</a>
        </div>
      </li>)}</ul>
    </MasterDialog>}
    {bank&&<MasterDialog title={bank==='new'?'Tambah Bank':'Edit Bank'} close={()=>setBank(null)} save={saveBank}>
      <input type="hidden" name="id" value={bank==='new'?'':bank.id}/>
      <Field label="Kode Bank" htmlFor="bank-code" required><Input id="bank-code" name="kode" defaultValue={bank==='new'?'':bank.code||''} maxLength={30} required/></Field>
      <Field label="Nama Bank" htmlFor="bank-name" required><Input id="bank-name" name="nama" defaultValue={bank==='new'?'':bank.name} maxLength={150} required/></Field>
      <Field label="Status Bank" htmlFor="bank-status"><Select id="bank-status" name="status" defaultValue={bank==='new'||bank.is_active?'active':'inactive'}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select></Field>
    </MasterDialog>}
  </>;
}
