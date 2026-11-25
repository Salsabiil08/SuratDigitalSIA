import {createAdminClient} from '@/lib/supabase/admin';
import {jakartaDate} from '@/domain/workflow';
import {higherReviewer} from '@/domain/reviewer-hierarchy';
// Called only after Auth and letter access checks. Does not grant reviewer mandates.
export async function assertReviewerHierarchy(creatorId:string,reviewerId:string) {
  const {data,error}=await createAdminClient().from('user_assignments')
    .select('profile_id,start_date,end_date,position:positions!user_assignments_position_id_fkey(code,level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(is_active)')
    .in('profile_id',[creatorId,reviewerId]).eq('is_active',true).order('start_date',{ascending:false});
  if(error)throw new Error('Hierarki pemeriksa belum dapat diverifikasi.');
  const today=jakartaDate();
  const assignment=(id:string)=>(data||[]).find((a:any)=>a.profile_id===id&&(!a.start_date||a.start_date<=today)&&(!a.end_date||a.end_date>=today));
  const creator=assignment(creatorId),reviewer=assignment(reviewerId);
  const creatorPosition=creator?.position as any,reviewerPosition=reviewer?.position as any;
  const creatorLevel=creatorPosition?.is_active&&(creator?.unit as any)?.is_active?creatorPosition.level:0;
  const reviewerLevel=reviewerPosition?.is_active&&(reviewer?.unit as any)?.is_active?reviewerPosition.level:0;
  if(creatorId===reviewerId||!['GM','SM','DIR'].includes(reviewerPosition?.code)||!higherReviewer(creatorLevel,reviewerLevel))throw new Error('Pemeriksa harus GM, Senior Manager, atau Direktur dengan jabatan lebih tinggi dan kewenangan pemeriksaan yang sah.');
}
