import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),receive:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
vi.mock('@/server/mailbox',()=>({readMailbox:m.read}));
vi.mock('@/server/actions/delivery',()=>({receiveInternalLetterAction:m.receive}));
import {MailboxClient} from '../src/components/mailbox/mailbox-client';
import {PreparedMailbox} from '../src/components/mailbox/prepared-mailbox';
import type {MailboxData,MailboxItem} from '../src/domain/mailbox';
const query={filter:'ALL' as const,q:'',page:1,pageSize:10};
const item:MailboxItem={dispatch_id:'d',letter_id:'l',sender_id:'s',sender_name:'Pengirim Sah',subject:'Surat pengujian',official_number:'001-IN/SIA',sent_at:'2026-11-18T01:00:00Z',finalized_at:'2026-11-18T00:00:00Z',letter_status:'NUMBERED',recipients:[{profile_id:'p',name:'Penerima Utama',role:'PRIMARY',read_at:null,received_at:null,requires_response:false}]};
const data:MailboxData={items:[item],total:1,page:1,pageSize:10,pages:1};
beforeEach(()=>vi.resetAllMocks());
it('inbox menampilkan fakta terpisah dan tombol receipt eksplisit; render tidak melakukan mutasi',()=>{
 const html=renderToStaticMarkup(<MailboxClient folder="INBOX" data={data} query={query}/>);
 for(const text of ['Kotak Masuk','Pengirim Sah','001-IN/SIA','Dokumen final','Terkirim','Dibaca','Diterima','Konfirmasi Terima Surat','Belum Dibaca','Belum Diterima','Sudah Diterima'])expect(html).toContain(text);
 expect(html).not.toContain('Selesai');expect(m.receive).not.toHaveBeenCalled();expect(html).toContain('sm:flex-row');expect(html).toContain('md:grid-cols-2');
});
it('CC ditampilkan terpisah tanpa tombol receipt utama atau kewajiban balas',()=>{
 const cc={...item,recipients:[{...item.recipients[0]!,role:'CC' as const,name:'Pegawai Tembusan'}]};
 const html=renderToStaticMarkup(<MailboxClient folder="INBOX" data={{...data,items:[cc]}} query={query}/>);expect(html).toContain('Tembusan (CC)');expect(html).toContain('Tidak otomatis wajib membalas.');expect(html).not.toContain('Konfirmasi Terima Surat');
});
it('outbox mempertahankan status tiap penerima; agregat tidak menyatakan semua diterima karena final',()=>{
 const multi={...item,recipients:[{...item.recipients[0]!,read_at:'2026-11-18T02:00:00Z',received_at:'2026-11-18T03:00:00Z'},{profile_id:'cc',name:'Salinan',role:'CC' as const,read_at:null,received_at:null,requires_response:false}]};
 const html=renderToStaticMarkup(<MailboxClient folder="OUTBOX" data={{...data,items:[multi]}} query={query}/>);expect(html).toContain('Penerima Utama');expect(html).toContain('Salinan');expect(html).toContain('penerimaan utama 1/1');expect(html).toContain('Belum dibaca');expect(html).not.toContain('Konfirmasi Terima Surat');expect(m.receive).not.toHaveBeenCalled();
});
it('error query ditampilkan sebagai error, bukan keadaan sukses kosong',async()=>{
 m.read.mockRejectedValue(new Error('DB tidak tersedia'));const view=await PreparedMailbox({folder:'INBOX',searchParams:{}});const html=renderToStaticMarkup(view);expect(html).toContain('role="alert"');expect(html).toContain('Coba Kembali');expect(html).not.toContain('Belum ada surat resmi');
});
it('daftar kosong dan pagination sah ditampilkan dengan filter/pencarian yang terjaga',()=>{
 const html=renderToStaticMarkup(<MailboxClient folder="INBOX" data={{items:[],total:0,page:1,pageSize:10,pages:1}} query={query}/>);expect(html).toContain('Belum ada surat resmi');expect(html).toContain('Halaman 1 dari 1');
 const paged=renderToStaticMarkup(<MailboxClient folder="OUTBOX" data={{...data,page:2,pages:3,total:25}} query={{...query,q:'Rapat & Unit',filter:'UNREAD'}}/>);expect(paged).toContain('Halaman 2 dari 3');expect(paged).toContain('q=Rapat+%26+Unit');expect(paged).toContain('filter=UNREAD');
});
