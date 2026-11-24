'use client';
import {useState} from 'react';
import {Input} from './field';
export function RupiahInput({id,value,onValueChange}:{id:string;value:number;onValueChange:(value:number)=>void}){
 const [editing,setEditing]=useState(false);
 return <div className="relative"><span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-600 pointer-events-none">Rp</span>
 <Input id={id} className="w-full pl-10" type={editing?'number':'text'} inputMode="decimal" required min="0.01" max="999999999999.99" step="0.01" value={editing?(value||''):value?value.toLocaleString('id-ID',{maximumFractionDigits:2}):''} onFocus={()=>setEditing(true)} onBlur={()=>setEditing(false)} onChange={e=>onValueChange(Number(e.target.value))}/>
 </div>;
}
