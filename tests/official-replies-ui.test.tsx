import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/server/actions/official-replies',()=>({createOfficialReplyAction:m.create}));
import {OfficialReplyPanel} from '../src/components/letters/official-reply-panel';
import {MailboxClient} from '../src/components/mailbox/mailbox-client';
vi.mock('@/server/actions/delivery',()=>({receiveInternalLetterAction:vi.fn()}));
import type {ReplyContext} from '../src/domain/official-replies';
const context:ReplyContext={seed:{dispatchId:'d',senderId:'s',officialNumber:'001-IN/SIA',subject:'Asal',categoryCode:'PERMOHONAN'},links:[],recipients:[]};
it('tindakan hanya muncul bila server memberi seed penerima utama, render tidak membuat draf',()=>{
 const html=renderToStaticMarkup(<OfficialReplyPanel letterId="origin" context={context}/>);expect(html).toContain('Balas dengan Surat Resmi');expect(html).toContain('Kategori awal mengikuti surat asal');expect(m.create).not.toHaveBeenCalled();
 const cc=renderToStaticMarkup(<OfficialReplyPanel letterId="origin" context={{...context,seed:null}}/>);expect(cc).not.toContain('Balas dengan Surat Resmi');
});
it('hubungan menampilkan aktor/waktu/identitas, draf tidak dinyatakan sudah dibalas',()=>{
 const links:ReplyContext['links']=[{id:'link',direction:'REPLY',letterId:'reply',subject:'Balasan sah',officialNumber:null,status:'DRAFT',createdAt:'2026-11-18T01:00:00Z',actorId:'r',actorName:'Penerima Sah',sentAt:null}];
 const html=renderToStaticMarkup(<OfficialReplyPanel letterId="origin" context={{...context,links}}/>);expect(html).toContain('Penerima Sah');expect(html).toContain('Identitas: reply');expect(html).toContain('Belum diterbitkan');expect(html).toContain('Belum dikirim; belum tercatat sebagai balasan terkirim');expect(html).toContain('href="/surat/reply"');
 const sent=renderToStaticMarkup(<OfficialReplyPanel letterId="reply" context={{...context,seed:null,links:[{...links[0]!,direction:'ORIGIN',sentAt:'2026-11-18T03:00:00Z'}]}}/>);expect(sent).toContain('Buka Surat Asal');expect(sent).toContain('Sudah dikirim pada');
});
it('mailbox membedakan status balasan per penerima tanpa mengonfirmasi penerimaan',()=>{
 const html=renderToStaticMarkup(<MailboxClient folder="OUTBOX" query={{filter:'ALL',q:'',page:1,pageSize:10}} data={{total:1,page:1,pages:1,pageSize:10,items:[{dispatch_id:'d',letter_id:'l',sender_id:'s',sender_name:'Pengirim',subject:'Asal',official_number:'001',sent_at:'2026-11-18T00:00:00Z',finalized_at:null,letter_status:'NUMBERED',recipients:[{profile_id:'p',name:'Utama',role:'PRIMARY',read_at:null,received_at:null,requires_response:false,replied_at:'2026-11-18T03:00:00Z'},{profile_id:'cc',name:'Salinan',role:'CC',read_at:null,received_at:null,requires_response:false}]}]}}/>);
 expect(html).toContain('Sudah Dibalas');expect(html).toContain('Belum dikonfirmasi');expect(html).toContain('Tidak otomatis wajib membalas.');expect(html.match(/Sudah Dibalas/g)).toHaveLength(1);
});
