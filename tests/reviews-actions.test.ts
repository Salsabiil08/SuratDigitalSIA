import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),client:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/server/auth',()=>({requireUser:m.user}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:m.admin}));
vi.mock('@/lib/supabase/server',()=>({createClient:m.client}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import { decideReviewAction, getPendingReviewsAction } from '../src/server/actions/reviews';
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:'reviewer-from-session'});m.admin.mockReturnValue({rpc:m.rpc});m.rpc.mockResolvedValue({error:null});});
it('aktor keputusan berasal sesi, versi dan revisi diteruskan untuk validasi database',async()=>{
 expect((await decideReviewAction('step','version',3,'PASS')).success).toBe(true);
 expect(m.rpc).toHaveBeenCalledWith('decide_letter_review',expect.objectContaining({p_actor:'reviewer-from-session',p_step:'step',p_version:'version',p_revision:3,p_action:'PASS'}));
});
it('tanpa akun aktif tidak menyentuh service role',async()=>{
 m.user.mockRejectedValue(new Error('Akun tidak aktif'));
 expect((await decideReviewAction('step','version',3,'PASS')).success).toBe(false);expect(m.admin).not.toHaveBeenCalled();
});
it('gagal RPC bukan sukses dan tidak merevalidasi',async()=>{
 m.rpc.mockResolvedValue({error:{message:'Versi sudah berubah'}});
 expect((await decideReviewAction('step','version',3,'PASS')).success).toBe(false);expect(m.revalidate).not.toHaveBeenCalled();
});
it('inbox mengecualikan penugasan versi lama, akses dicabut dan milik reviewer lain',async()=>{
 const q:any={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockResolvedValue({error:null,data:[
  {id:'valid',letter_id:'l',version_id:'v',letter:{subject:'Surat',current_version_id:'v',reviewer_id:'reviewer-from-session',review_status:'WAITING'}},
  {id:'old',version_id:'old',letter:{current_version_id:'new',reviewer_id:'reviewer-from-session',review_status:'WAITING'}},
  {id:'revoked',letter:null},
  {id:'other',version_id:'v',letter:{current_version_id:'v',reviewer_id:'someone',review_status:'WAITING'}},
 ]})};m.client.mockReturnValue({from:()=>q});
 expect(await getPendingReviewsAction()).toEqual([{id:'valid',letterId:'l',subject:'Surat'}]);expect(q.eq).toHaveBeenCalledWith('reviewer_id','reviewer-from-session');
});
