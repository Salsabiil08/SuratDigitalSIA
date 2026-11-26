import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/auth';

export const registerColumns = ['Nomor urut','Nomor surat','Tanggal surat','Jenis surat','Unit','Pengirim','Penerima','Perihal','Bulan','Tahun','Status nomor'];

export function registerFilters(params: URLSearchParams) {
  const numeric = (key:string, min:number, max:number) => {
    const value = Number(params.get(key));
    return Number.isInteger(value) && value>=min && value<=max ? value : null;
  };
  const type = params.get('jenis') || '';
  const status = params.get('status') || '';
  return {
    p_search: (params.get('q') || '').trim().slice(0,150),
    p_type: ['IN','KRE','Tag'].includes(type) ? type : '',
    p_status: ['ALLOCATED','COMPLETED','CANCELLED'].includes(status) ? status : '',
    p_year: numeric('tahun',1900,9999), p_month: numeric('bulan',1,12),
  };
}

export async function numberRegister(params:URLSearchParams) {
  await requireUser();
  const db = await createClient();
  const filters = registerFilters(params);
  return async (offset:number, limit:number) => {
    const {data,error} = await db.rpc('read_number_register',{...filters,p_offset:offset,p_limit:limit});
    if(error) throw new Error('Register nomor belum dapat dimuat.');
    return (data||[]) as RegisterRow[];
  };
}

interface RegisterRow {
  issuance_id:string;
  sequence_number:number;
  official_number:string;
  letter_date:string|null;
  type_name:string;
  unit_name:string|null;
  sender_name:string|null;
  recipient_name:string|null;
  subject:string|null;
  month:number|null;
  year:number|null;
  number_status:string;
}

const statusLabels:Record<string,string>={ALLOCATED:'Diterbitkan',COMPLETED:'Selesai',CANCELLED:'Batal'};
export function registerCells(row:RegisterRow) {
  return [row.sequence_number,row.official_number,row.letter_date,row.type_name,row.unit_name,row.sender_name,row.recipient_name,row.subject,row.month,row.year,statusLabels[row.number_status]||row.number_status];
}
