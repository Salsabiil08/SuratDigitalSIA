import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({user:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('@/server/auth',()=>({requireUser:m.user}));vi.mock('@/lib/supabase/server',()=>({createClient:m.client}));
// Jika implementasi mencoba admin client, tes harus gagal.
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>{throw new Error('Service role dilarang untuk daftar');}}));
import {readMailbox} from '../src/server/mailbox';
const query={filter:'ALL' as const,q:'Perihal',page:1,pageSize:10};
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:'session-user'});m.client.mockReturnValue({rpc:m.rpc});m.rpc.mockResolvedValue({data:{items:[],total:0,page:1,pages:1,pageSize:10},error:null});});
it('daftar memakai client sesi dan RPC tanpa parameter actor',async()=>{expect((await readMailbox('INBOX',query)).total).toBe(0);expect(m.rpc).toHaveBeenCalledWith('list_internal_mailbox',{p_folder:'INBOX',p_filter:'ALL',p_query:'Perihal',p_page:1,p_size:10});});
it('tanpa Auth aktif tidak membuat query',async()=>{m.user.mockRejectedValue(new Error('Tidak aktif'));await expect(readMailbox('INBOX',query)).rejects.toThrow();expect(m.client).not.toHaveBeenCalled();});
it.each([{data:null,error:{message:'DB gagal'}},{data:null,error:null},{data:{},error:null}])('gagal query/response bukan sukses daftar kosong',async value=>{m.rpc.mockResolvedValue(value);await expect(readMailbox('OUTBOX',query)).rejects.toThrow(/belum dapat diambil/);});
it('adds comment status per authorized recipient without loading comment contents',async()=>{m.rpc.mockResolvedValue({data:{items:[{dispatch_id:'d',recipients:[{profile_id:'p'},{profile_id:'other'}]}],total:1,page:1,pages:1,pageSize:10},error:null});const filter=vi.fn().mockResolvedValue({data:[{dispatch_id:'d',author_id:'p',commented_at:'2026-11-24'}],error:null});const select=vi.fn(()=>({in:filter}));m.client.mockReturnValue({rpc:m.rpc,from:()=>({select})});const data=await readMailbox('OUTBOX',query);expect(data.items[0]!.recipients[0]!.commented_at).toBe('2026-11-24');expect(data.items[0]!.recipients[1]!.commented_at).toBeNull();expect(select).toHaveBeenCalledWith('dispatch_id,author_id,commented_at');});
it('does not turn a failed response-summary query into an empty success',async()=>{m.rpc.mockResolvedValue({data:{items:[{dispatch_id:'d',recipients:[]}],total:1,page:1,pages:1,pageSize:10},error:null});m.client.mockReturnValue({rpc:m.rpc,from:()=>({select:()=>({in:async()=>({data:null,error:{message:'error'}})})})});await expect(readMailbox('INBOX',query)).rejects.toThrow(/Status tanggapan/);});

it('menggabungkan semua halaman tanpa kehilangan surat dan mengabaikan halaman URL',async()=>{
 const item=(id:string)=>({dispatch_id:id,recipients:[]});
 m.rpc.mockResolvedValueOnce({data:{items:Array.from({length:10},(_,i)=>item(String(i))),total:11,page:1,pages:2,pageSize:10},error:null}).mockResolvedValueOnce({data:{items:[item('10')],total:11,page:2,pages:2,pageSize:10},error:null});
 m.client.mockReturnValue({rpc:m.rpc,from:()=>({select:()=>({in:async()=>({data:[],error:null})})})});
 const result=await readMailbox('INBOX',{...query,page:2,pageSize:50});
 expect(result.items).toHaveLength(11);expect(m.rpc.mock.calls.map(c=>c[1].p_page)).toEqual([1,2]);
});
