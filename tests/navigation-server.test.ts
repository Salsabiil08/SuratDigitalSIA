import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({results:{} as Record<string,any>,filters:[] as any[],client:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:m.client}));
import {readNavigationAccess} from '../src/server/navigation-access';
const user:any={id:'actor',isSuperAdmin:false,isOfficialSigner:false,position:{code:'STF'},unit:{id:'unit'}};
beforeEach(()=>{
 m.filters=[];m.results={review_authorizations:{data:[],error:null},approver_authorizations:{data:[],error:null},letter_types:{data:{creator_unit_id:'finance'},error:null}};
 m.client.mockImplementation(async()=>({from:(table:string)=>{const q:any={};for(const name of ['select','eq','lte','or'])q[name]=(...args:any[])=>{m.filters.push([table,name,...args]);return q;};for(const name of ['limit','maybeSingle'])q[name]=async()=>m.results[table];return q;}}));
});
it('memeriksa penugasan akun sendiri dengan masa berlaku dan unit Finance terkonfigurasi',async()=>{
 m.results.review_authorizations.data=[{id:'grant'}];const x=await readNavigationAccess(user);
 expect(x.access.review).toBe(false);expect(x.access.billing).toBe(false);
 expect((await readNavigationAccess({...user,position:{code:'GM'}})).access.review).toBe(true);expect(m.filters.some(f=>f[0]==='review_authorizations')).toBe(false);expect(m.filters).toContainEqual(['approver_authorizations','eq','approver_id','actor']);
 expect(m.filters.some(f=>f[1]==='lte'&&f[2]==='starts_on')).toBe(true);
 expect((await readNavigationAccess({...user,unit:{id:'finance'}})).access.billing).toBe(true);
});
it('kegagalan pemeriksaan grant ditampilkan dan tidak memberikan menu kewenangan',async()=>{
 m.results.approver_authorizations={data:[{id:'untrusted'}],error:{message:'Query gagal'}};
 const x=await readNavigationAccess(user);expect(x.access.review).toBe(false);expect(x.error).toBeTruthy();
});
