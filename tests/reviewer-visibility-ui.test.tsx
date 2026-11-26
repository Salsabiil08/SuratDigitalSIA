import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/components/ui/rich-text-editor',()=>({RichTextEditor:()=> <div/>}));
vi.mock('@/server/actions/workflow',()=>({getWorkflowOptions:vi.fn(),getWorkflowLetter:vi.fn()}));
import {LetterEditor} from '../src/components/letters/letter-editor';
function render(requested:boolean,reviewer=false){
 const options:any={user:{id:'maker',position:{code:'STF',level:1},unit:{id:'u',name:'Unit'}},people:reviewer?[{id:'r',name:'Pemeriksa Sah',title:'GM',level:2,position:'GM',signer:false}]:[],banks:[],categories:[{id:'cat',code:'LAPORAN',name:'Laporan'}],reviewRules:[{category_code:'LAPORAN',requires_review:true}],reviewerGrants:reviewer?[{reviewerId:'r'}]:[],approverGrants:[]};
 const data:any={letter:{id:'l',source:'CREATE',type:{code:'IN'},subject:'Uji',document_category:{code:'LAPORAN'},review_requested:requested,signer_ids:[],mandatory_approver_ids:[],letter_date:'2026-11-24'},versions:[],items:[],dispositionContext:{tasks:[]},replyContext:{links:[]}};
 return renderToStaticMarkup(<LetterEditor initialOptions={options} initialData={data}/>);
}
it('category selector is removed and review defaults to No',()=>{const html=render(false);expect(html).not.toContain('Kategori Surat');expect(html).toContain('Perlu pemeriksaan isi?');expect(html).toContain('value="no" selected=""');});
it('No hides the reviewer even when legacy category required review',()=>{expect(render(false,true)).not.toContain('Pemeriksa Isi Surat');});
it('Yes shows a concise missing-reviewer message and permits saving a draft',()=>{const html=render(true);expect(html).toContain('Pemeriksa Isi Surat');expect(html).toContain('Belum ada pejabat aktif di atas jabatan Anda.');});
it('Yes exposes only authorized reviewers',()=>{const html=render(true,true);expect(html).toContain('Pemeriksa Isi Surat');expect(html).toContain('Pemeriksa Sah');expect(html).not.toContain('Belum ada pejabat aktif');});

it.each([['STF',['GM','SM','DIR']],['GM',['SM','DIR']],['SM',['DIR']],['DIR',[]]] as const)('%s shows only higher roles without any manual grants', (role,expected)=>{
 const options:any={user:{id:'creator',position:{code:role},unit:{id:'u'}},people:['STF','GM','SM','DIR','ADMIN'].map((position,i)=>({id:'p'+i,name:'Name '+position,title:position,position,level:i+1,signer:false})),banks:[],categories:[],reviewRules:[],reviewerGrants:[],approverGrants:[]};
 const data:any={letter:{id:'l',source:'CREATE',type:{code:'IN'},subject:'Fixture',review_requested:true,signer_ids:[],letter_date:'2026-11-25'},versions:[],items:[],replyContext:{links:[]},dispositionContext:{tasks:[]}};
 const html=renderToStaticMarkup(<LetterEditor initialOptions={options} initialData={data}/>);const field=html.split('id="letter-reviewer"')[1]?.split('</select>')[0]||'';
 for(const candidate of ['STF','GM','SM','DIR','ADMIN'])expect(field.includes('Name '+candidate)).toBe((expected as readonly string[]).includes(candidate));
});
