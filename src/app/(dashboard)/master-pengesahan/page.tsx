import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertAssetOwner, saveSigningAsset } from '@/server/signing-assets';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

async function save(form: FormData) {
  'use server';
  const user=await requireUser();
  const kind=form.get('kind');
  const file=form.get('image');
  if((kind!=='SIGNATURE'&&kind!=='STAMP')||!(file instanceof File)||!file.size) throw new Error('Pilih berkas PNG.');
  await saveSigningAsset(user,kind,file);
  revalidatePath('/master-pengesahan');
}

export default async function MasterSigningPage() {
  const user=await requireUser();
  try { assertAssetOwner(user); } catch { return <p>Akun tidak berwenang mengelola aset pengesahan.</p>; }
  const {data,error}=await createAdminClient().from('official_signing_assets')
    .select('kind,updated_at').eq('owner_id',user.id);
  if(error) return <p>Aset belum dapat dimuat.</p>;
  return <div className="space-y-4">
    <PageHeader title="Master Pengesahan"/>
    {(['SIGNATURE','STAMP'] as const).map(kind=>{
      const label=kind==='SIGNATURE'?'Tanda Tangan':'Stempel';
      const asset=data.find(row=>row.kind===kind);
      return <Card className="p-4" key={kind}>
        <form action={save} className="space-y-3">
          <input type="hidden" name="kind" value={kind}/>
          <Field label={label} htmlFor={kind}>
            <Input id={kind} name="image" type="file" accept="image/png" required/>
          </Field>
          <p className="text-sm">{asset?'Aset tersedia. Unggah PNG untuk mengganti.':'Belum ada aset. Unggah PNG maksimal 512 KB.'}</p>
          <Button type="submit">Simpan {label}</Button>
        </form>
      </Card>;
    })}
  </div>;
}
