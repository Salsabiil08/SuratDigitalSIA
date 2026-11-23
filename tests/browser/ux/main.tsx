import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ActionNotice,ActionNoticeProvider} from '../../../src/components/ui/action-notice';
import {IndonesianValidation} from '../../../src/components/ui/indonesian-validation';
import {Button} from '../../../src/components/ui/button';
import {DisposisiClient} from '../../../src/app/(dashboard)/disposisi/disposisi-client';
import '../../../src/app/globals.css';
const initial=await (await fetch('/ux-data'+location.search)).json();
function Harness(){const [message,setMessage]=useState(0);return <ActionNoticeProvider><IndonesianValidation/><main style={{height:'100dvh',overflow:'auto',padding:16}}><Button onClick={()=>setMessage(x=>x+1)}>Uji Popup Gagal</Button>{message>0&&<ActionNotice eventKey={message}>Tindakan uji belum berhasil. Silakan coba kembali.</ActionNotice>}<form onSubmit={e=>e.preventDefault()}><label htmlFor="ux-name">Nama wajib</label><input id="ux-name" required/><label htmlFor="ux-choice">Pilihan wajib</label><select id="ux-choice" required defaultValue=""><option value="">Pilih</option><option value="one">Satu</option></select><Button type="submit">Uji Validasi</Button></form><DisposisiClient initialData={initial.data}/></main></ActionNoticeProvider>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
