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
it.each([false,true])('removes separate reviewer controls even from legacy drafts (%s)',requested=>{const html=render(requested,true);expect(html).not.toContain('Kategori Surat');expect(html).not.toContain('Perlu pemeriksaan isi?');expect(html).not.toContain('Pemeriksa Isi Surat');expect(html).not.toContain('letter-reviewer');});
