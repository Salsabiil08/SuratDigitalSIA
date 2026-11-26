import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeBytes } from '@/server/letter-workflow';
import { validateLetterhead } from '@/server/letterhead';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

async function publish(form:FormData) {
  'use server';
  const actor=await requireSuperAdmin();
  const file=form.get('kop');
  if(!(file instanceof File)||!file.size||file.size>3*1024*1024)throw new Error('Pilih DOCX kop maksimal 3 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  await validateLetterhead(bytes);
  const document=await storeBytes(actor.id,bytes,'DOCX');
  const {error}=await createAdminClient().rpc('publish_letterhead',{
    p_actor:actor.id,p_type:String(form.get('jenis')),p_path:document.path,p_hash:document.hash,
  });
  if(error)throw new Error(error.message);
  revalidatePath('/admin/master-surat');
}
async function saveBank(form:FormData) {
  'use server';
  const actor=await requireSuperAdmin();
  const {error}=await createAdminClient().rpc('save_r05_bank',{
    p_actor:actor.id,p_id:form.get('id')||null,p_code:String(form.get('kode')||''),
    p_name:String(form.get('nama')||''),p_active:form.get('status')==='active',
  });
  if(error)throw new Error(error.message);
  revalidatePath('/admin/master-surat');
}

export default async function MasterLetterPage() {
  await requireSuperAdmin();
  const db=createAdminClient();
  const [banks,templates]=await Promise.all([
    db.from('master_bank').select('id,code,name,is_active').order('name'),
    db.from('letter_templates').select('id,version,letter_types!inner(code)').eq('is_active',true).not('template_path','is',null),
  ]);
  if(banks.error||templates.error)return <p>Master kop dan bank belum dapat dimuat.</p>;
  return <div className="space-y-4">
    <PageHeader title="Master Kop dan Bank"/>
    <Card className="space-y-3 p-4">
      <h2 className="font-bold">Kop Surat</h2>
      <ul className="text-sm">{['IN','KRE','Tag'].map(code=>{
        const row=templates.data.find(item=>(item.letter_types as unknown as {code:string}).code===code);
        return <li key={code}>{code} · {row ? `Versi ${row.version}`:'Kop bawaan SIADocs'}</li>;
      })}</ul>
      <form action={publish} className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis surat" htmlFor="master-kop-type"><Select id="master-kop-type" name="jenis"><option value="IN">Internal</option><option value="KRE">Eksternal</option><option value="Tag">Tagihan</option></Select></Field>
        <Field label="Kop DOCX" htmlFor="master-kop"><Input id="master-kop" name="kop" type="file" accept=".docx" required/></Field>
        <Button type="submit">Aktifkan Kop</Button>
      </form>
    </Card>
    <Card className="space-y-3 p-4">
      <h2 className="font-bold">Master Bank</h2>
      {[{id:'',code:'',name:'',is_active:true},...banks.data].map(bank=><form action={saveBank} key={bank.id||'new'} className="grid gap-2 sm:grid-cols-4">
        <input type="hidden" name="id" value={bank.id}/>
        <Input name="kode" aria-label="Kode bank" placeholder="Kode bank" defaultValue={bank.code||''} required maxLength={30}/>
        <Input name="nama" aria-label="Nama bank" placeholder="Nama bank" defaultValue={bank.name||''} required maxLength={150}/>
        <Select name="status" aria-label="Status bank" defaultValue={bank.is_active?'active':'inactive'}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select>
        <Button type="submit" variant={bank.id?'secondary':'primary'}>{bank.id?'Perbarui Bank':'Tambah Bank'}</Button>
      </form>)}
    </Card>
  </div>;
}
