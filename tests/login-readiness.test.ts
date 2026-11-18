import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({signIn:vi.fn(),signOut:vi.fn(),current:vi.fn(),clear:vi.fn(),redirect:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{signInWithPassword:m.signIn,signOut:m.signOut}})}));vi.mock('@/server/auth',()=>({clearLocalSession:m.clear,getCurrentUser:m.current,requireUser:vi.fn()}));vi.mock('next/navigation',()=>({redirect:m.redirect}));
import {loginAction} from '../src/server/actions/auth';
const form=()=>{const f=new FormData();f.set('email','uat@example.invalid');f.set('password','temporary');return f;};
beforeEach(()=>vi.resetAllMocks());
it('network/5xx yang dikembalikan SDK tidak disamakan dengan kata sandi salah',async()=>{m.signIn.mockResolvedValue({data:{user:null},error:{name:'AuthRetryableFetchError',status:0}});expect((await loginAction(null,form()))?.error).toContain('belum dapat dihubungi');expect(m.redirect).not.toHaveBeenCalled();});
it('kredensial salah tetap tidak menghasilkan login sukses',async()=>{m.signIn.mockResolvedValue({data:{user:null},error:{status:400}});expect((await loginAction(null,form()))?.error).toContain('tidak sesuai');expect(m.redirect).not.toHaveBeenCalled();});
it('akun tanpa profil aktif menutup sesi yang baru dibuat',async()=>{m.signIn.mockResolvedValue({data:{user:{id:'u'}},error:null});m.current.mockResolvedValue(null);expect((await loginAction(null,form()))?.error).toContain('Profil belum aktif');expect(m.signOut).toHaveBeenCalled();expect(m.redirect).not.toHaveBeenCalled();});
