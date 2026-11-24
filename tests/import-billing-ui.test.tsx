import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/components/ui/rich-text-editor',()=>({RichTextEditor:()=> <div/>}));
vi.mock('@/server/actions/workflow',()=>({getWorkflowOptions:vi.fn(),getWorkflowLetter:vi.fn()}));
import {LetterEditor} from '../src/components/letters/letter-editor';
function render(finance:boolean,source:'UPLOAD'|'CREATE'='UPLOAD',existing=false){
 const options:any={user:{id:'maker',position:{code:'STF',level:1},unit:{id:finance?'finance':'accounting',name:'Unit'}},financeUnitId:'finance',people:[{id:'sm',name:'SM',title:'Senior Manager',level:3,position:'SM',signer:true},{id:'dir',name:'Dirut',title:'Direktur Utama',level:4,position:'DIR',signer:true}],banks:[],categories:[],reviewRules:[],reviewerGrants:[],approverGrants:[]};
 const data:any=existing?{letter:{id:'l',source,type:{code:'Tag'},subject:'Tagihan',signer_ids:['sm','dir'],mandatory_approver_ids:['sm','dir'],letter_date:'2026-11-24'},versions:[],items:[],billing:{bank_id:'',account_number:'',payee_name:''},dispositionContext:{tasks:[]},replyContext:{links:[]}}:undefined;
 return renderToStaticMarkup(<LetterEditor source={source} id={existing?'l':undefined} initialData={data} initialOptions={options}/>);
}
it('offers billing import to Finance and keeps the initial type selectable',()=>{const html=render(true);expect(html).toContain('value="Tag"');expect(html).toContain('Surat Penagihan');expect(html.match(/<select[^>]*id="letter-type"[^>]*>/)?.[0]).not.toMatch(/\sdisabled(?:=|>)/);});
it('does not offer billing import to other units or add it to the ordinary create form',()=>{expect(render(false)).not.toContain('value="Tag"');expect(render(true,'CREATE')).not.toContain('value="Tag"');});
it('existing billing import retains two signatures, line items, attachment requirement and type lock',()=>{const html=render(true,'UPLOAD',true);expect(html).toContain('Data Pencatatan Tagihan');expect(html).toContain('Data ini tidak mengubah dokumen impor.');expect(html).toContain('Lampiran bukti tagihan (wajib');expect(html).toContain('Dua tanda tangan berurutan');expect(html).toContain('Ganti Dokumen Impor');expect(html.match(/<select[^>]*id="letter-type"[^>]*>/)?.[0]).toMatch(/\sdisabled(?:=|>)/);});
