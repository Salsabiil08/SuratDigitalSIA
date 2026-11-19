import {createAdminClient} from '@/lib/supabase/admin';
import {jakartaDate} from '@/domain/workflow';
import {higherReviewer} from '@/domain/reviewer-hierarchy';
// Called only after Auth and letter access checks. Does not grant reviewer mandates.
export async function assertReviewerHierarchy(creatorId:string,reviewerId:string) {
  const {data,error}=await createAdminClient().from('user_assignments')
    .select('profile_id,start_date,end_date,position:positions!user_assignments_position_id_fkey(level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(is_active)')
    .in('profile_id',[creatorId,reviewerId]).eq('is_active',true).order('start_date',{ascending:false});
  if(error)throw new Error('Hierarki pemeriksa belum dapat diverifikasi.');
  const today=jakartaDate();
  const level=(id:string)=>{const a=(data||[]).find((a:any)=>a.profile_id===id&&(!a.start_date||a.start_date<=today)&&(!a.end_date||a.end_date>=today));return (a?.position as any)?.is_active&&(a?.unit as any)?.is_active?(a?.position as any).level:0;};
  if(creatorId===reviewerId||!higherReviewer(level(creatorId),level(reviewerId)))throw new Error('Pemeriksa harus memiliki jabatan lebih tinggi dari pembuat surat dan kewenangan pemeriksaan yang sah.');
}
