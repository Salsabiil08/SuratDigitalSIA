import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    p_status: ['ISSUED','ALLOCATED','COMPLETED','CANCELLED'].includes(status) ? status : '',
    p_year: numeric('tahun',1900,9999), p_month: numeric('bulan',1,12),
  };
}

export async function numberRegister(params:URLSearchParams) {
  const user = await requireUser();
  const db = user.isSuperAdmin ? createAdminClient() : await createClient();
  const filters = registerFilters(params);
  const read=async (offset:number, limit:number) => {
    const args={...filters,p_offset:offset,p_limit:limit};
    const {data,error}=user.isSuperAdmin
      ? await db.rpc('read_admin_number_history',{...args,p_actor:user.id})
      : await db.rpc('read_number_register',args);
    if(error) throw new Error('Register nomor belum dapat dimuat.');
    return (data||[]) as RegisterRow[];
  };
  return {read,isAdmin:user.isSuperAdmin,
    columns:user.isSuperAdmin?registerColumns.filter((_,index)=>index<5||index>7):registerColumns,
    cells:(row:RegisterRow)=>user.isSuperAdmin?registerCells(row).filter((_,index)=>index<5||index>7):registerCells(row)};
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

const statusLabels:Record<string,string>={ISSUED:'Diterbitkan',ALLOCATED:'Dicadangkan',COMPLETED:'Selesai',CANCELLED:'Batal'};
export function registerCells(row:RegisterRow) {
  return [row.sequence_number,row.official_number,row.letter_date,row.type_name,row.unit_name,row.sender_name,row.recipient_name,row.subject,row.month,row.year,statusLabels[row.number_status]||row.number_status];
}
