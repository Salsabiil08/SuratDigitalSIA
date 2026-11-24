import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/components/ui/rich-text-editor',()=>({RichTextEditor:()=> <div/>}));
vi.mock('@/server/actions/workflow',()=>({getWorkflowOptions:vi.fn(),getWorkflowLetter:vi.fn()}));
import {LetterEditor} from '../src/components/letters/letter-editor';
function render(category:string,required=false,reviewer=false){
 const options:any={user:{id:'maker',position:{code:'STF',level:1},unit:{id:'u',name:'Unit'}},people:reviewer?[{id:'r',name:'Pemeriksa Sah',title:'GM',level:2,position:'GM',signer:false}]:[],banks:[],categories:[{id:'cat',code:'LAPORAN',name:'Laporan'}],reviewRules:[{category_code:'LAPORAN',requires_review:required}],reviewerGrants:reviewer?[{reviewerId:'r'}]:[],approverGrants:[]};
 const data:any={letter:{id:'l',source:'CREATE',type:{code:'IN'},subject:'Uji',document_category:{code:category},signer_ids:[],mandatory_approver_ids:[],letter_date:'2026-11-24'},versions:[],items:[],dispositionContext:{tasks:[]},replyContext:{links:[]}};
 return renderToStaticMarkup(<LetterEditor initialOptions={options} initialData={data}/>);
}
it('no reviewer warning before category selection',()=>{expect(render('',true)).not.toContain('Pemeriksa Surat');});
it('optional review without eligible reviewers is hidden',()=>{expect(render('LAPORAN')).not.toContain('Pemeriksa Surat');});
it('mandatory review stays visible with a concise missing-reviewer message',()=>{const html=render('LAPORAN',true);expect(html).toContain('wajib sebelum pengajuan');expect(html).toContain('Pemeriksa belum tersedia. Hubungi Super Admin. Draf tetap dapat disimpan.');});
it('optional authorized reviewer remains available',()=>{const html=render('LAPORAN',false,true);expect(html).toContain('Pemeriksa Surat');expect(html).toContain('Pemeriksa Sah');expect(html).not.toContain('Pemeriksa belum tersedia');});
