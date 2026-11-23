import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {fieldMessage,readableMessage,NOTICE_DURATION} from '../src/domain/ui-feedback';
import {DispositionStatusBanner} from '../src/components/letters/disposition-status-banner';
import {Button} from '../src/components/ui/button';
import {RecoveryState} from '../src/components/ui/recovery-state';
import {letterNextStep} from '../src/domain/letter-next-step';
const mocks=vi.hoisted(()=>({user:vi.fn()}));
vi.mock('@/server/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
import AdminLayout from '../src/app/(dashboard)/admin/layout';
it('keeps all administration children hidden for Staff and available to an authorized administrator',async()=>{
 mocks.user.mockResolvedValue({isSuperAdmin:false});const denied=renderToStaticMarkup(await AdminLayout({children:<button>Tambah rahasia</button>}));expect(denied).toContain('Akses terbatas');expect(denied).toContain('Ke Dashboard');expect(denied).not.toContain('Tambah rahasia');
 mocks.user.mockResolvedValue({isSuperAdmin:true});expect(renderToStaticMarkup(await AdminLayout({children:<p>Daftar administrasi</p>}))).toContain('Daftar administrasi');
 mocks.user.mockResolvedValue(null);await expect(AdminLayout({children:'data'})).rejects.toThrow('redirect');
});
it('explains disabled actions and prevents pre-hydration activation',()=>{
 const html=renderToStaticMarkup(<Button disabledReason="Isi catatan perbaikan terlebih dahulu.">Minta Perbaikan</Button>);expect(html).toContain('disabled');expect(html).toContain('aria-describedby');expect(html).toContain('Isi catatan perbaikan terlebih dahulu.');
 const loading=renderToStaticMarkup(<Button isLoading loadingLabel="Mengirim…">Kirim</Button>);expect(loading).toContain('aria-busy="true"');expect(loading).toContain('Mengirim…');
});
it('names the next disposition actor without treating a reply as completion',()=>{
 for(const [status,name] of [['NEW','Pelaksana'],['IN_PROGRESS','Pelaksana'],['IN_REVIEW','Pemberi'],['REVISION_REQUESTED','Pelaksana']] as const){
  const html=renderToStaticMarkup(<DispositionStatusBanner task={{status,giverName:'Pemberi',recipientName:'Pelaksana'} as any}/>);expect(html).toContain('Menunggu: '+name);expect(html).toContain('Pemberi Disposisi');expect(html).toContain('Penerima Tugas');
 }
 const done=renderToStaticMarkup(<DispositionStatusBanner task={{status:'DONE',giverName:'Pemberi',recipientName:'Pelaksana'} as any}/>);expect(done).not.toContain('Menunggu:');expect(done).toContain('Hasil tugas telah diterima.');
});
it('offers recovery and uses the download section for external finalized letters',()=>{
 const html=renderToStaticMarkup(<RecoveryState title="Surat tidak dapat dibuka" message="Surat tidak ditemukan atau Anda tidak memiliki akses." href="/surat" label="Kembali ke Daftar Surat"/>);expect(html).toContain('href="/surat"');expect(html).toContain('Ke Dashboard');
 const actor={creator:true,review:false,approval:false,signing:false,sent:false,recipient:false,received:false};
 const l={status:'NUMBERED',required_signature_count:1,signature_mode:'IN_APP',signature_status:'UPLOADED',finalized_at:'now',type:{category:'BILLING'}};
 expect(letterNextStep(l,actor).target).toBe('preview');expect(letterNextStep(l,actor).description).toContain('di luar SIADocs');expect(letterNextStep({...l,type:{category:'INTERNAL'}},actor).target).toBe('delivery');
});
it('uses Indonesian validation and actionable errors without exposing signing markers',()=>{
 expect(fieldMessage({valueMissing:true} as ValidityState,{tagName:'INPUT'})).toBe('Isi bagian ini terlebih dahulu.');
 expect(fieldMessage({valueMissing:true} as ValidityState,{tagName:'SELECT'})).toBe('Pilih salah satu pilihan terlebih dahulu.');
 expect(readableMessage('Posisi {{STAMP}} belum dikenali')).not.toContain('{{');
 expect(readableMessage('Supabase Storage timeout')).not.toContain('Supabase');
 expect(readableMessage('Pilih pemeriksa berwenang.')).toBe('Pilih pemeriksa berwenang.');
 expect(NOTICE_DURATION).toEqual({success:4000,info:6000,error:8000});
});
