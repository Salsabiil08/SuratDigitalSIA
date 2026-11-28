'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type SaveMaster = (form: FormData) => Promise<{ error?: string }>;

export function MasterDialog({title, close, save, children, submit='Simpan'}:{
  title:string; close:()=>void; save?:SaveMaster; children:ReactNode; submit?:string;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function onSubmit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!save || pending)return;
    const form=new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const result=await save(form);
      if(result.error)setError(result.error);
      else close();
    } catch {
      setError('Perubahan belum dapat disimpan. Coba lagi.');
    } finally {
      setPending(false);
    }
  }
  return <dialog ref={dialog} aria-label={title} onCancel={event=>{event.preventDefault();if(!pending)close();}}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/50 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={close}>Tutup</Button>
    </div>
    {save ? <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={pending} className="min-w-0 space-y-4">{children}</fieldset>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button type="submit" isLoading={pending}>{submit}</Button>
    </form> : children}
  </dialog>;
}

export function MasterStatus({active}:{active:boolean}) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${active?'bg-emerald-50 text-emerald-800':'bg-neutral-100 text-neutral-700'}`}>{active?'Aktif':'Nonaktif'}</span>;
}

const pageSize=10;

export function MasterTable<T extends {id:string;is_active:boolean}>({rows,columns,searchText,searchLabel,addLabel,onAdd,onEdit,numbered=false}:{
  rows:T[];columns:{label:string;value:(row:T)=>ReactNode}[]; searchText:(row:T)=>string;
  searchLabel:string;addLabel:string;onAdd:()=>void;onEdit:(row:T)=>void;numbered?:boolean;
}) {
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [page,setPage]=useState(1);
  const term=query.trim().toLocaleLowerCase('id-ID');
  const filtered=rows.filter(row=>searchText(row).toLocaleLowerCase('id-ID').includes(term) && (status==='all' || row.is_active===(status==='active')));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const current=Math.min(page,pages);
  const offset=(current-1)*pageSize;
  return <Card className="min-w-0 space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-3">
      <Input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} className="sm:max-w-xs"/>
      <Select aria-label="Filter status" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}} className="sm:w-40">
        <option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option>
      </Select>
      <Button type="button" className="sm:ml-auto" onClick={onAdd}>{addLabel}</Button>
    </div>
    <Table>
      <TableHeader><TableRow>
        {numbered&&<TableHead scope="col">No</TableHead>}
        {columns.map(column=><TableHead key={column.label} scope="col">{column.label}</TableHead>)}
        <TableHead scope="col">Status</TableHead><TableHead scope="col">Aksi</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {filtered.slice(offset,offset+pageSize).map((row,index)=><TableRow key={row.id}>
          {numbered&&<TableCell>{offset+index+1}</TableCell>}
          {columns.map(column=><TableCell key={column.label} className="break-words">{column.value(row)}</TableCell>)}
          <TableCell><MasterStatus active={row.is_active}/></TableCell>
          <TableCell><Button type="button" variant="secondary" size="sm" onClick={()=>onEdit(row)}>Edit</Button></TableCell>
        </TableRow>)}
        {!filtered.length&&<TableRow><TableCell colSpan={columns.length+2+Number(numbered)} className="py-8 text-center text-neutral-600">{rows.length?'Tidak ada hasil yang sesuai.':'Belum ada data.'}</TableCell></TableRow>}
      </TableBody>
    </Table>
    {pages>1&&<nav aria-label="Halaman data master" className="flex flex-wrap items-center justify-end gap-2">
      <Button size="sm" variant="secondary" disabled={current===1} onClick={()=>setPage(current-1)}>Sebelumnya</Button>
      <span className="text-sm">{current} dari {pages}</span>
      <Button size="sm" variant="secondary" disabled={current===pages} onClick={()=>setPage(current+1)}>Berikutnya</Button>
    </nav>}
  </Card>;
}
