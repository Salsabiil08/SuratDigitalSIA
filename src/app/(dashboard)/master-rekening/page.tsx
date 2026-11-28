import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { PaymentAccountManagement } from './management-client';

async function save(form:FormData) {
  'use server';
  const user=await requireUser();
  const status=form.get('status');
  if(status!=='active'&&status!=='inactive')return {error:'Pilih status rekening.'};
  const {error}=await createAdminClient().rpc('manage_payment_account',{
    p_actor:user.id,p_id:form.get('id')||null,p_bank:String(form.get('bank')),p_holder:String(form.get('holder')||''),
    p_account:String(form.get('account')||''),p_active:status==='active',
  });
  if(error)return {error:error.message};
  revalidatePath('/master-rekening');
  return {};
}

export default async function PaymentAccountsPage() {
  const user=await requireUser();
  const db=await createClient();
  const {data:type}=await db.from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle();
  if(!user.unit?.id||user.unit.id!==type?.creator_unit_id) return <p>Akun tidak berwenang melihat master rekening.</p>;
  const [banks,accounts]=await Promise.all([
    db.from('master_bank').select('id,name,is_active').order('name'),
    db.from('master_payment_accounts').select('id,bank_id,holder_name,account_number,is_active').order('holder_name'),
  ]);
  if(banks.error||accounts.error) return <p>Master rekening belum dapat dimuat.</p>;
  return <div className="space-y-4">
    <PageHeader title="Master Rekening"/>
    <PaymentAccountManagement accounts={accounts.data.map(row=>({
      ...row,bankName:banks.data.find(bank=>bank.id===row.bank_id)?.name||'—',
    }))} banks={banks.data} save={save}/>
  </div>;
}
