import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),admin:vi.fn(),read:vi.fn(),download:vi.fn(),revalidate:vi.fn(),inspect:vi.fn()}));
vi.mock('@/server/auth',()=>({requireUser:m.user}));
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:m.admin}));
vi.mock('@/server/letter-workflow',()=>({readLetter:m.read,downloadVersion:m.download,peopleOptions:vi.fn()}));
vi.mock('@/lib/letter-document',()=>({inspectDocument:m.inspect}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {reviewLetterAction,restartApprovalAction} from '../src/server/actions/workflow';
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:'session-actor'});m.admin.mockReturnValue({rpc:m.rpc});m.read.mockResolvedValue({type:{code:'KRE'},required_signature_count:1,signature_areas:[]});m.download.mockResolvedValue({bytes:new Uint8Array(),format:'DOCX'});m.rpc.mockResolvedValue({data:'READY_TO_ISSUE',error:null});});
it('konfirmasi pembuat eksplisit dan aktor dari sesi diteruskan ke RPC terpisah',async()=>{
 expect((await reviewLetterAction('l','SUBMIT',7,undefined,true)).success).toBe(true);
 expect(m.rpc).toHaveBeenCalledWith('submit_letter_for_approval',{p_actor:'session-actor',p_letter:'l',p_revision:7,p_confirm_self:true});
});
it('default pengajuan tidak menyatakan persetujuan pembuat tanpa konfirmasi',async()=>{
 await reviewLetterAction('l','SUBMIT',7);expect(m.rpc).toHaveBeenCalledWith('submit_letter_for_approval',expect.objectContaining({p_confirm_self:false}));
});
it('review/approval bukan jalan menyamar sebagai pembuat lain',async()=>{
 m.user.mockRejectedValue(new Error('Tidak aktif'));expect((await reviewLetterAction('l','APPROVE',7)).success).toBe(false);expect(m.admin).not.toHaveBeenCalled();
});
it('gagal approval dan koreksi tidak dilaporkan berhasil',async()=>{
 m.rpc.mockResolvedValue({error:{message:'Versi tidak berlaku'}});expect((await reviewLetterAction('l','APPROVE',7)).success).toBe(false);expect((await restartApprovalAction('l',7,'Koreksi')).success).toBe(false);expect(m.revalidate).not.toHaveBeenCalled();
});

it('manual signing does not require digital signature placement but still validates number placement',async()=>{
 m.read.mockResolvedValue({type:{code:'KRE'},source:'UPLOAD',signature_mode:'EXTERNAL',required_signature_count:1,signature_areas:[{page:1}],number_area:{page:1}});
 await reviewLetterAction('l','SUBMIT',7);expect(m.inspect).toHaveBeenCalledWith(expect.anything(),'DOCX',0,[],true);
});
it('imported in-app signing permits the signed-document upload fallback without requiring image placement',async()=>{
 m.read.mockResolvedValue({type:{code:'KRE'},source:'UPLOAD',signature_mode:'IN_APP',required_signature_count:1,signature_areas:[{page:1}]});
 await reviewLetterAction('l','SUBMIT',7);expect(m.inspect).toHaveBeenCalledWith(expect.anything(),'DOCX',0,[],true);
});
