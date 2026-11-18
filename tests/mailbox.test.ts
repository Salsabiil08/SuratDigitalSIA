import {expect,it} from 'vitest';
import {mailboxQuery,mailboxHref,recipientSummary,mailboxDate} from '../src/domain/mailbox';
import {notificationHref} from '../src/domain/notification-links';
it('menormalkan filter/page/size dan input berlebihan tanpa actor dari browser',()=>{
 expect(mailboxQuery({filter:'constructor',page:'-3',size:'1000',q:['other'],actor_id:'other'})).toEqual({filter:'ALL',page:1,pageSize:10,q:''});
 expect(mailboxQuery({filter:'UNREAD',page:'2',size:'20',q:'  Surat  '})).toEqual({filter:'UNREAD',page:2,pageSize:20,q:'Surat'});
 expect(mailboxQuery({q:'a'.repeat(120)}).q).toHaveLength(100);
});
it('pencarian URL diencode sebagai nilai literal; pagination mempertahankan filter dan kata pencarian',()=>{
 const url=mailboxHref('INBOX',{filter:'UNRECEIVED',page:2,pageSize:10,q:'%_ &filter=RECEIVED'});const parsed=new URL(url,'https://example.test');expect(parsed.pathname).toBe('/kotak-masuk');expect(parsed.searchParams.get('filter')).toBe('UNRECEIVED');expect(parsed.searchParams.get('q')).toBe('%_ &filter=RECEIVED');
});
it('agregat hanya memakai penerima aktual; CC tidak dihitung sebagai receipt wajib',()=>{
 expect(recipientSummary([{profile_id:'p',name:'Primary',role:'PRIMARY',read_at:null,received_at:'2026-11-18',requires_response:false},{profile_id:'cc',name:'CC',role:'CC',read_at:'2026-11-18',received_at:null,requires_response:false}])).toEqual({total:2,read:1,primary:1,received:1,cc:1});expect(mailboxDate(null)).toBeNull();expect(mailboxDate('2026-11-18T00:00:00Z')).toContain('WIB');
});
it('notifikasi internal menuju surat dengan asal kotak yang benar; tautan tidak membuat receipt',()=>{
 expect(notificationHref({letter_id:'l',event_type:'INTERNAL_SENT'})).toBe('/surat/l?asal=kotak-masuk');expect(notificationHref({letter_id:'l',event_type:'INTERNAL_RECEIVED'})).toBe('/surat/l?asal=kotak-keluar');expect(notificationHref({})).toBe('/notifikasi');expect(notificationHref({disposition_id:'d',letter_id:'l'})).toBe('/disposisi');
});
