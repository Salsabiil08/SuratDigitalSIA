'use client';

import { useState } from 'react';
import { MasterDialog, MasterTable, type SaveMaster } from '@/components/master/management';
import { Field, Input, Select } from '@/components/ui/field';

export type Account={id:string;bank_id:string;bankName:string;holder_name:string;account_number:string;is_active:boolean};
type BankOption={id:string;name:string;is_active:boolean};

export function PaymentAccountManagement({accounts,banks,save}:{accounts:Account[];banks:BankOption[];save:SaveMaster}) {
  const [selected,setSelected]=useState<Account|'new'|null>(null);
  const row=selected==='new'?null:selected;
  return <>
    <MasterTable rows={accounts} columns={[
      {label:'Bank',value:account=>account.bankName},
      {label:'Nama Pemilik Rekening',value:account=>account.holder_name},
      {label:'Nomor Rekening',value:account=><span className="font-mono">{account.account_number}</span>},
    ]} searchText={account=>`${account.bankName} ${account.holder_name} ${account.account_number}`} searchLabel="Cari bank, pemilik, atau rekening"
      addLabel="Tambah Rekening" onAdd={()=>setSelected('new')} onEdit={setSelected}/>
    {selected&&<MasterDialog title={row?'Edit Rekening':'Tambah Rekening'} close={()=>setSelected(null)} save={save}>
      <input type="hidden" name="id" value={row?.id||''}/>
      <Field label="Bank" htmlFor="account-bank" required>
        <Select id="account-bank" name="bank" required defaultValue={row?.bank_id||''}>
          <option value="">Pilih bank</option>
          {banks.filter(bank=>bank.is_active||bank.id===row?.bank_id).map(bank=><option key={bank.id} value={bank.id}>{bank.name}{bank.is_active?'':' (nonaktif)'}</option>)}
        </Select>
      </Field>
      <Field label="Nama Pemilik Rekening" htmlFor="account-holder" required><Input id="account-holder" name="holder" defaultValue={row?.holder_name} maxLength={500} required/></Field>
      <Field label="Nomor Rekening" htmlFor="account-number" required><Input id="account-number" name="account" defaultValue={row?.account_number} maxLength={100} required/></Field>
      <Field label="Status Rekening" htmlFor="account-status"><Select id="account-status" name="status" defaultValue={!row||row.is_active?'active':'inactive'}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select></Field>
    </MasterDialog>}
  </>;
}
