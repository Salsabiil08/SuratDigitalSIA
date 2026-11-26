import {createAdminClient} from '@/lib/supabase/admin';
import {jakartaDate} from '@/domain/workflow';
import {roleReviewer} from '@/domain/reviewer-hierarchy';
// Called only after Auth and letter access checks. Business reviewers follow the SIA role hierarchy.
export async function assertReviewerHierarchy(creatorId:string,reviewerId:string) {
  const {data,error}=await createAdminClient().from('user_assignments')
    .select('profile_id,start_date,end_date,position:positions!user_assignments_position_id_fkey(code,is_active),unit:organizational_units!user_assignments_unit_id_fkey(is_active)')
    .in('profile_id',[creatorId,reviewerId]).eq('is_active',true).order('start_date',{ascending:false,nullsFirst:false});
  if(error)throw new Error('Hierarki pemeriksa belum dapat diverifikasi.');
  const today=jakartaDate();
  const code=(id:string)=>{const a=(data||[]).find((a:any)=>a.profile_id===id&&(!a.start_date||a.start_date<=today)&&(!a.end_date||a.end_date>=today)&&(a.position as any)?.is_active&&(a.unit as any)?.is_active);return (a?.position as any)?.code||'';};
  if(creatorId===reviewerId||!roleReviewer(code(creatorId),code(reviewerId)))throw new Error('Pemeriksa harus memiliki jabatan lebih tinggi dari pembuat surat dalam struktur organisasi yang aktif.');
}
