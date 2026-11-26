import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

async function save(form:FormData) {
  'use server';
  const user=await requireUser();
  const {error}=await createAdminClient().rpc('save_payment_account',{
    p_actor:user.id,p_bank:String(form.get('bank')),p_holder:String(form.get('holder')||''),
    p_account:String(form.get('account')||''),p_active:form.get('status')==='active',
  });
  if(error) throw new Error(error.message);
  revalidatePath('/master-rekening');
}

export default async function PaymentAccountsPage() {
  const user=await requireUser();
  const db=await createClient();
  const {data:type}=await db.from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle();
  if(!user.unit?.id||user.unit.id!==type?.creator_unit_id) return <p>Akun tidak berwenang melihat master rekening.</p>;
  const [banks,accounts]=await Promise.all([
    db.from('master_bank').select('id,code,name').eq('is_active',true).order('name'),
    db.from('master_payment_accounts').select('id,holder_name,account_number,is_active,bank:master_bank(name)').order('holder_name'),
  ]);
  if(banks.error||accounts.error) return <p>Master rekening belum dapat dimuat.</p>;
  return <div className="space-y-4">
    <PageHeader title="Master Rekening"/>
    <Card className="p-4">
      <form action={save} className="grid gap-3 md:grid-cols-2">
        <Select name="bank" aria-label="Bank" required defaultValue=""><option value="">Pilih bank</option>{banks.data.map(bank=><option key={bank.id} value={bank.id}>{bank.name}</option>)}</Select>
        <Input name="holder" aria-label="Nama pemilik rekening" placeholder="Nama pemilik rekening" maxLength={500} required/>
        <Input name="account" aria-label="Nomor rekening" placeholder="Nomor rekening" maxLength={100} required/>
        <Select name="status" aria-label="Status rekening"><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select>
        <Button type="submit">Simpan Rekening</Button>
      </form>
    </Card>
    <Card className="divide-y p-4">{accounts.data.map(row=><p key={row.id} className="py-2 break-words">{row.holder_name} · {(row.bank as unknown as {name:string}|null)?.name} · {row.account_number} · {row.is_active?'Aktif':'Nonaktif'}</p>)}</Card>
  </div>;
}
