import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { numberRegister, registerFilters } from '@/server/number-register';

export default async function NumberRegisterPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(await searchParams)) if(typeof value==='string') query.set(key,value);
  const filters = registerFilters(query);
  const page = Math.min(10000,Math.max(1,Math.trunc(Number(query.get('halaman'))||1)));
  query.delete('halaman');
  const pageUrl = (value:number) => '/register-nomor?'+new URLSearchParams([...query,['halaman',String(value)]]);
  const register = await numberRegister(query);
  const rows = await register.read((page-1)*50,51);
  const searchLabel=register.isAdmin?'Cari nomor atau unit':'Cari nomor atau perihal';
  const types=[{code:'',label:'Semua jenis'},{code:'IN',label:'Internal'},{code:'KRE',label:'Eksternal'},{code:'Tag',label:'Pengantar Tagihan'}];
  return <div className="space-y-4">
    <PageHeader title={register.isAdmin?"Riwayat Surat Bernomor":"Register Nomor Surat"} actions={<Link className="text-brand-red underline" href={'/api/register-nomor?'+query}>Ekspor Excel</Link>} />
    <nav aria-label="Jenis surat" className="flex flex-wrap gap-2">
      {types.map(type=>{
        const next=new URLSearchParams(query);
        if(type.code)next.set('jenis',type.code);
        else next.delete('jenis');
        const active=filters.p_type===type.code;
        return <Link key={type.code} href={'/register-nomor?'+next} aria-current={active?'page':undefined}
          className={`rounded-full border px-3 py-2 text-sm font-semibold ${active?'border-brand-red bg-red-50 text-brand-red':'border-neutral-200 bg-white text-neutral-700'}`}>{type.label}</Link>;
      })}
    </nav>
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="jenis" value={filters.p_type}/>
      <Input name="q" aria-label={searchLabel} placeholder={searchLabel} defaultValue={filters.p_search} />
      <Input name="bulan" type="number" min={1} max={12} aria-label="Bulan penerbitan" placeholder="Bulan (1–12)" defaultValue={filters.p_month??''} />
      <Input name="tahun" type="number" min={1900} max={9999} aria-label="Tahun penerbitan" placeholder="Tahun" defaultValue={filters.p_year??''} />
      <Select name="status" aria-label="Status nomor" defaultValue={filters.p_status}>
        <option value="">Semua status</option><option value="ISSUED">Diterbitkan</option><option value="ALLOCATED">Dicadangkan</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Batal</option>
      </Select>
      <Button type="submit">Cari</Button>
    </form>
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-100"><tr>{register.columns.map(column=><th scope="col" className="p-3 whitespace-nowrap" key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.slice(0,50).map(row=><tr className="border-t" key={row.issuance_id}>{register.cells(row).map((cell,index)=><td className="p-3" key={index}>{cell??'—'}</td>)}</tr>)}</tbody>
      </table>
      {rows.length===0&&<p className="p-4">Tidak ada nomor surat sesuai pencarian.</p>}
    </Card>
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Halaman register">
      {page>1&&<Link href={pageUrl(page-1)}>Sebelumnya</Link>}
      {rows.length>50&&<Link href={pageUrl(page+1)}>Berikutnya</Link>}
    </nav>
  </div>;
}
