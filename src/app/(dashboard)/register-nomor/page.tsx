import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { numberRegister, registerCells, registerColumns, registerFilters } from '@/server/number-register';

export default async function NumberRegisterPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(await searchParams)) if(typeof value==='string') query.set(key,value);
  const filters = registerFilters(query);
  const page = Math.min(10000,Math.max(1,Math.trunc(Number(query.get('halaman'))||1)));
  query.delete('halaman');
  const pageUrl = (value:number) => '/register-nomor?'+new URLSearchParams([...query,['halaman',String(value)]]);
  const read = await numberRegister(query);
  const rows = await read((page-1)*50,51);
  return <div className="space-y-4">
    <PageHeader title="Register Nomor Surat" actions={<Link className="text-brand-red underline" href={'/api/register-nomor?'+query}>Ekspor Excel</Link>} />
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input name="q" aria-label="Cari nomor atau perihal" placeholder="Cari nomor atau perihal" defaultValue={filters.p_search} />
      <Select name="jenis" aria-label="Jenis surat" defaultValue={filters.p_type}>
        <option value="">Semua jenis</option><option value="IN">Internal</option><option value="KRE">Eksternal</option><option value="Tag">Tagihan</option>
      </Select>
      <Input name="bulan" type="number" min={1} max={12} aria-label="Bulan penerbitan" placeholder="Bulan (1–12)" defaultValue={filters.p_month??''} />
      <Input name="tahun" type="number" min={1900} max={9999} aria-label="Tahun penerbitan" placeholder="Tahun" defaultValue={filters.p_year??''} />
      <Select name="status" aria-label="Status nomor" defaultValue={filters.p_status}>
        <option value="">Semua status</option><option value="ISSUED">Diterbitkan</option><option value="ALLOCATED">Dicadangkan</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Batal</option>
      </Select>
      <Button type="submit">Cari</Button>
    </form>
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-100"><tr>{registerColumns.map(column=><th scope="col" className="p-3 whitespace-nowrap" key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.slice(0,50).map(row=><tr className="border-t" key={row.issuance_id}>{registerCells(row).map((cell,index)=><td className="p-3" key={index}>{cell??'—'}</td>)}</tr>)}</tbody>
      </table>
      {rows.length===0&&<p className="p-4">Tidak ada nomor surat sesuai pencarian.</p>}
    </Card>
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Halaman register">
      {page>1&&<Link href={pageUrl(page-1)}>Sebelumnya</Link>}
      {rows.length>50&&<Link href={pageUrl(page+1)}>Berikutnya</Link>}
    </nav>
  </div>;
}
