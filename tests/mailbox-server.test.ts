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
