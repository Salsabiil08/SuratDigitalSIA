import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeBytes } from '@/server/letter-workflow';
import { validateLetterhead } from '@/server/letterhead';
import { PageHeader } from '@/components/ui/page-header';
import { MasterLetterManagement, type LetterheadVersion } from './management-client';

async function publish(form:FormData) {
  'use server';
  const actor=await requireSuperAdmin();
  const file=form.get('kop');
  const jenis=String(form.get('jenis'));
  if(!['IN','KRE','Tag'].includes(jenis)||form.get('confirm')!=='on')return {error:'Konfirmasi aktivasi kop untuk jenis surat ini.'};
  if(!(file instanceof File)||!file.size||file.size>3*1024*1024||!/^([^/\\\p{Cc}]{1,250})\.docx$/iu.test(file.name))
    return {error:'Pilih berkas DOCX kop maksimal 3 MB dengan nama yang valid.'};
  try {
    const bytes=new Uint8Array(await file.arrayBuffer());
    await validateLetterhead(bytes);
    const document=await storeBytes(actor.id,bytes,'DOCX');
    const db=createAdminClient();
    const {error}=await db.rpc('publish_letterhead_named',{
      p_actor:actor.id,p_type:jenis,p_path:document.path,p_hash:document.hash,p_filename:file.name,
    });
    if(error)return {error:'Kop belum dapat diaktifkan. Coba lagi.'};
  } catch(error) {
    return {error:error instanceof Error && /DOCX kop|gambar lokal|dokumen|DOCX/i.test(error.message)
      ? error.message : 'Berkas DOCX belum dapat diproses.'};
  }
  revalidatePath('/admin/master-surat');
  return {};
}

async function saveBank(form:FormData) {
  'use server';
  const actor=await requireSuperAdmin();
  const status=form.get('status');
  if(status!=='active'&&status!=='inactive')return {error:'Pilih status bank.'};
  const {error}=await createAdminClient().rpc('save_r05_bank',{
    p_actor:actor.id,p_id:form.get('id')||null,p_code:String(form.get('kode')||''),
    p_name:String(form.get('nama')||''),p_active:status==='active',
  });
  if(error)return {error:error.code==='23505'?'Kode bank sudah digunakan.':error.message};
  revalidatePath('/admin/master-surat');
  return {};
}

export default async function MasterLetterPage() {
  await requireSuperAdmin();
  const db=createAdminClient();
  const [banks,templates,audit]=await Promise.all([
    db.from('master_bank').select('id,code,name,is_active').order('name').order('id'),
    db.from('letter_templates').select('id,version,is_active,original_file_name,letter_types!inner(code)').not('template_path','is',null).order('version',{ascending:false}),
    db.from('audit_logs').select('entity_id,occurred_at,profiles!audit_logs_actor_id_fkey(full_name)')
      .eq('action','LETTERHEAD_PUBLISHED').eq('entity_type','letter_templates').order('occurred_at',{ascending:false}),
  ]);
  if(banks.error||templates.error||audit.error)return <p>Master kop dan bank belum dapat dimuat.</p>;
  const versions:LetterheadVersion[]=templates.data.map(row=>{
    const event=audit.data.find(item=>item.entity_id===row.id);
    return {id:row.id,version:row.version,is_active:row.is_active,fileName:row.original_file_name,
      type:(row.letter_types as unknown as {code:string}).code,
      uploadedAt:event?.occurred_at||null,
      uploadedBy:(event?.profiles as unknown as {full_name:string}|null)?.full_name||null};
  });
  return <div className="space-y-4">
    <PageHeader title="Master Kop dan Bank"/>
    <MasterLetterManagement versions={versions} banks={banks.data} publish={publish} saveBank={saveBank}/>
  </div>;
}
