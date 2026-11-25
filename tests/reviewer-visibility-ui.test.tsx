import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/components/ui/rich-text-editor',()=>({RichTextEditor:()=> <div/>}));
vi.mock('@/server/actions/workflow',()=>({getWorkflowOptions:vi.fn(),getWorkflowLetter:vi.fn()}));
import {LetterEditor} from '../src/components/letters/letter-editor';
function render(requested:boolean,reviewer=false,creator='STF'){
 const roles=[{id:'gm',name:'GM Sah',title:'GM',level:2,position:'GM',signer:false},{id:'sm',name:'SM Sah',title:'Senior Manager',level:3,position:'SM',signer:false},{id:'dir',name:'Direktur Sah',title:'Direktur Utama',level:4,position:'DIR',signer:false},{id:'staff',name:'Staff Lain',title:'Staff',level:1,position:'STF',signer:false}];
 const options:any={user:{id:'maker',position:{code:creator,level:creator==='STF'?1:creator==='GM'?2:3},unit:{id:'u',name:'Unit'}},people:reviewer?roles:[],banks:[],categories:[{id:'cat',code:'LAPORAN',name:'Laporan'}],reviewRules:[{category_code:'LAPORAN',requires_review:true}],reviewerGrants:reviewer?roles.map(p=>({reviewerId:p.id})):[],approverGrants:[]};
 const data:any={letter:{id:'l',source:'CREATE',type:{code:'IN'},subject:'Uji',document_category:{code:'LAPORAN'},review_requested:requested,signer_ids:[],mandatory_approver_ids:[],letter_date:'2026-11-24'},versions:[],items:[],dispositionContext:{tasks:[]},replyContext:{links:[]}};
 return renderToStaticMarkup(<LetterEditor initialOptions={options} initialData={data}/>);
}
function reviewerSelect(html:string){const marker=html.indexOf('id="letter-reviewer"');const start=html.lastIndexOf('<select',marker);return html.slice(start,html.indexOf('</select>',marker));}
it('category selector is removed and review defaults to No',()=>{const html=render(false);expect(html).not.toContain('Kategori Surat');expect(html).toContain('Perlu pemeriksaan isi?');expect(html).toContain('value="no" selected=""');});
it('No hides the reviewer even when legacy category required review',()=>{expect(render(false,true)).not.toContain('Pemeriksa Surat');});
it('Yes shows a concise missing-reviewer message and permits saving a draft',()=>{const html=render(true);expect(html).toContain('Pemeriksa Isi Surat');expect(html).toContain('Pemeriksa belum tersedia. Hubungi Super Admin. Draf tetap dapat disimpan.');});
it('staff may choose one authorized reviewer among GM, SM, and Director',()=>{const html=render(true,true),select=reviewerSelect(html);expect(html).toContain('Pemeriksa Isi Surat');expect(select).toContain('GM Sah');expect(select).toContain('SM Sah');expect(select).toContain('Direktur Sah');expect(select).not.toContain('Staff Lain');expect(html).toContain('Pilih satu pemeriksa berwenang dari GM, Senior Manager, atau Direktur Utama.');});
it('GM can only select authorized roles above the creator',()=>{const select=reviewerSelect(render(true,true,'GM'));expect(select).toContain('SM Sah');expect(select).toContain('Direktur Sah');expect(select).not.toContain('GM Sah');expect(select).not.toContain('Staff Lain');});
