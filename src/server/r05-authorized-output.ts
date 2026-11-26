import { createAdminClient } from '@/lib/supabase/admin';
import { applyDocumentImages } from '@/lib/letter-document';
import { ASSET_BUCKET, downloadVersion, hashBytes, readLetter, storeBytes } from '@/server/letter-workflow';
import { requireUser } from '@/server/auth';

export async function finishAuthorizedOutput(id:string) {
  const user=await requireUser();
  let letter=await readLetter(id);
  if(!letter.official_sender_id||letter.required_signature_count===0||
    (letter.creator_id!==user.id&&!letter.signer_ids.includes(user.id))) {
    throw new Error('Akun tidak berwenang melanjutkan pengesahan ini.');
  }
  if(letter.finalized_at)return;
  if(letter.status!=='NUMBERED')throw new Error('Surat belum memiliki nomor resmi.');
  const db=createAdminClient();
  const consent=await db.from('r05_signing_consents').select('*').eq('letter_id',id)
    .eq('approval_cycle',letter.approval_cycle).eq('approval_version_id',letter.approval_plan_version);
  if(consent.error||!letter.signer_ids.every((signer:string)=>consent.data?.some(row=>row.signer_id===signer))){
    throw new Error('Otorisasi seluruh penandatangan belum tercatat.');
  }
  const source=await downloadVersion(letter);
  if(source.version.version_kind==='DRAFT'){
    const document=await storeBytes(letter.creator_id,source.bytes,source.format);
    const {error}=await db.rpc('record_numbered_document',{
      p_actor:letter.creator_id,p_letter:id,p_previous_version:source.version.id,p_document:document,
    });
    if(error)throw new Error(error.message);
    letter=await readLetter(id);
  }
  const requests=await db.from('signature_requests').select('id,signer_id,sign_order,status')
    .eq('letter_id',id).order('sign_order');
  if(requests.error||requests.data.length!==letter.required_signature_count)throw new Error('Daftar penandatangan belum dapat dimuat.');
  const asset=async(path:string,hash:string)=>{
    const {data,error}=await db.storage.from(ASSET_BUCKET).download(path);
    if(error||!data)throw new Error('Aset yang disetujui tidak dapat diambil.');
    const bytes=new Uint8Array(await data.arrayBuffer());
    if(hashBytes(bytes)!==hash)throw new Error('Aset pengesahan berbeda dari versi yang disetujui.');
    return bytes;
  };
  for(const request of requests.data){
    if(request.status==='UPLOADED')continue;
    const approved=consent.data!.find(row=>row.signer_id===request.signer_id)!;
    const source=await downloadVersion(letter);
    const images=[{
      marker:`{{SIGNATURE_${request.sign_order}}}`,bytes:await asset(approved.signature_path,approved.signature_hash),
      area:letter.signature_areas?.[request.sign_order-1],
    }];
    if(approved.stamp_path)images.push({
      marker:letter.type?.category==='BILLING'&&letter.source==='CREATE'?`{{STAMP_${request.sign_order}}}`:'{{STAMP}}',
      bytes:await asset(approved.stamp_path,approved.stamp_hash),area:letter.stamp_area,
    });
    const bytes=await applyDocumentImages(source.bytes,source.format,images);
    const document=await storeBytes(letter.creator_id,bytes,source.format);
    const {error}=await db.rpc('record_r05_authorized_signature',{
      p_request:request.id,p_revision:letter.revision,p_previous:source.version.id,p_document:document,
    });
    if(error)throw new Error(error.message);
    letter=await readLetter(id);
  }
  const finalSource=await downloadVersion(letter);
  let pdf=null;
  if(finalSource.format==='DOCX'){
    const {renderFinalPdf}=await import('@/server/render-final-pdf');
    const bytes=await renderFinalPdf(finalSource.bytes);
    pdf=await storeBytes(letter.creator_id,bytes,'PDF');
  }
  const {error}=await db.rpc('finalize_letter_with_pdf',{
    p_actor:letter.creator_id,p_letter:id,p_revision:letter.revision,p_source:finalSource.version.id,p_pdf:pdf,
  });
  if(error)throw new Error(error.message);
}
