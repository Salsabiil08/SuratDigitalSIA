import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({result:{data:[] as any[],error:null as any},filters:[] as any[]}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:(table:string)=>{m.filters.push(table);const q:any={};for(const name of ['select','in','eq'])q[name]=(...args:any[])=>{m.filters.push([name,...args]);return q;};q.order=async()=>m.result;return q;}})}));
import {assertReviewerHierarchy} from '../src/server/reviewer-hierarchy';
const row=(id:string,level:number,extra={})=>({profile_id:id,start_date:'2020-01-01',end_date:null,position:{level,code:({1:'STF',2:'GM',3:'SM',4:'DIR'} as any)[level],is_active:true},unit:{is_active:true},...extra});
beforeEach(()=>{m.result={data:[row('creator',2),row('reviewer',3)],error:null};m.filters=[];});
it('permits higher active role and reads only both authorized identities',async()=>{await expect(assertReviewerHierarchy('creator','reviewer')).resolves.toBeUndefined();expect(m.filters).toContainEqual(['in','profile_id',['creator','reviewer']]);});
it.each([1,2])('rejects reviewer at level %s for GM author',async level=>{m.result.data[1]=row('reviewer',level);await expect(assertReviewerHierarchy('creator','reviewer')).rejects.toThrow(/lebih tinggi/);});
it('fails closed on expired assignment, inactive unit, query failure and self-review',async()=>{
 m.result.data[1]=row('reviewer',4,{end_date:'2020-01-01'});await expect(assertReviewerHierarchy('creator','reviewer')).rejects.toThrow();
 m.result.data[1]=row('reviewer',4,{unit:{is_active:false}});await expect(assertReviewerHierarchy('creator','reviewer')).rejects.toThrow();
 await expect(assertReviewerHierarchy('creator','creator')).rejects.toThrow();
 m.result.error={message:'offline'};await expect(assertReviewerHierarchy('creator','reviewer')).rejects.toThrow(/belum dapat/);
});
