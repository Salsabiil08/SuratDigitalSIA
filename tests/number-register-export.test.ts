import JSZip from 'jszip';
import { beforeEach, expect, it, vi } from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('@/server/auth', () => ({requireUser: vi.fn().mockResolvedValue({id:'viewer'})}));
vi.mock('@/lib/supabase/server', () => ({createClient: vi.fn().mockResolvedValue({rpc:read})}));
import { GET } from '../src/app/api/register-nomor/route';

beforeEach(() => read.mockReset());

it('exports the same filtered register as XLSX and writes user text as literal cells', async () => {
  read.mockResolvedValue({data:[{
    issuance_id:'fixture',sequence_number:12,official_number:'0123-IN/ACH/SIA/11.2026',
    letter_date:'2026-11-27',type_name:'Internal',unit_name:'Accounting',
    sender_name:'Pengirim',recipient_name:'Penerima',subject:'=1+1 <uji>',
    month:11,year:2026,number_status:'CANCELLED',
  }],error:null});
  const response=await GET(new Request('https://local.test/api/register-nomor?jenis=IN&status=CANCELLED&tahun=2026'));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(read).toHaveBeenCalledWith('read_number_register',expect.objectContaining({p_type:'IN',p_status:'CANCELLED',p_year:2026}));
  const zip=await JSZip.loadAsync(await response.arrayBuffer());
  const sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  expect(sheet).toContain('0123-IN/ACH/SIA/11.2026');
  expect(sheet).toContain('=1+1 &lt;uji&gt;');
  expect(sheet).toContain('Batal');
  expect(sheet).not.toContain('<f>');
});
