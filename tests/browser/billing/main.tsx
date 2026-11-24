import React from 'react';
import {createRoot} from 'react-dom/client';
import {LetterEditor} from '../../../src/components/letters/letter-editor';
import {DocumentPreview} from '../../../src/components/letters/document-preview';
import {ActionNoticeProvider} from '../../../src/components/ui/action-notice';
import '../../../src/app/globals.css';
const options:any={user:{id:'finance-author',fullName:'Pengaju Finance',unit:{id:'fin',code:'FIN',name:'Finance'},position:{code:'STF',level:1}},financeUnitId:'fin',people:[{id:'sm',name:'Pejabat SM',title:'Senior Manager',position:'SM',unit:'FIN',level:3,signer:true},{id:'dir',name:'Pejabat Direktur',title:'Direktur Utama',position:'DIR',unit:'ACH',level:4,signer:true}],banks:[{id:'mandiri',name:'Bank Mandiri'}],categories:[{id:'notice',code:'PEMBERITAHUAN',name:'Pemberitahuan'}],reviewRules:[],reviewerGrants:[],approverGrants:[]};
const preview=new URLSearchParams(location.search).has('preview');
createRoot(document.getElementById('root')!).render(<ActionNoticeProvider><div style={{height:'100dvh',overflow:'auto',padding:16}}>{preview?<DocumentPreview url={new URLSearchParams(location.search).has('legacy')?'/billing-legacy-example':'/billing-example'} format="DOCX"/>:<LetterEditor billing initialOptions={options}/>}</div></ActionNoticeProvider>);
