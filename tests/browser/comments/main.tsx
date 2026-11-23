import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {LetterCommentsPanel} from '../../../src/components/letters/letter-comments-panel';
import {OfficialReplyPanel} from '../../../src/components/letters/official-reply-panel';
import {ActionNoticeProvider} from '../../../src/components/ui/action-notice';
import {responseLabel} from '../../../src/domain/letter-comments';
import '../../../src/app/globals.css';
const initial=await (await fetch('/comment-data')).json();
function Harness(){const [context,setContext]=useState(initial);async function refresh(){setContext(await (await fetch('/comment-data')).json());}return <ActionNoticeProvider><main style={{height:'100dvh',overflow:'auto',padding:16}}><output aria-label="Status tanggapan">{responseLabel(context.recipientCommented,false)}</output><LetterCommentsPanel letterId="source" context={context} onChanged={()=>void refresh()}/><OfficialReplyPanel letterId="source" context={{seed:{dispatchId:'d',senderId:'sender',officialNumber:'001-IN',subject:'Uji',categoryCode:'PEMBERITAHUAN'},links:[],recipients:[]}}/></main></ActionNoticeProvider>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
