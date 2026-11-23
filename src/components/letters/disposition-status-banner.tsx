import type {DispositionItem} from '@/server/actions/dispositions';
const stages={NEW:['Belum Dimulai','Mulai kerjakan tugas sesuai instruksi.'],IN_PROGRESS:['Diproses','Lengkapi hasil tugas sebelum mengirimnya untuk pemeriksaan.'],IN_REVIEW:['Menunggu Pemeriksaan','Periksa hasil, lalu terima atau minta perbaikan.'],REVISION_REQUESTED:['Perlu Perbaikan','Perbaiki hasil sesuai catatan, lalu kirim kembali.'],DONE:['Selesai','Hasil tugas telah diterima.']} as const;
export function DispositionStatusBanner({task}:{task:DispositionItem}){
 const [label,instruction]=stages[task.status];
 const waiting=task.status==='IN_REVIEW'?task.giverName:task.recipientName;
 return <section aria-label="Tahap disposisi" className="rounded-xl border-l-4 border-red-700 bg-neutral-50 p-4 text-sm space-y-2"><p className="font-bold">Tahap: {label}</p><dl className="grid gap-2 sm:grid-cols-2"><div><dt className="text-neutral-600">Pemberi Disposisi</dt><dd>{task.giverName}</dd></div><div><dt className="text-neutral-600">Penerima Tugas</dt><dd>{task.recipientName}</dd></div></dl>{task.status!=='DONE'&&<p className="font-semibold">Menunggu: {waiting} — {task.status==='IN_REVIEW'?'Pemberi Disposisi':'Penerima Tugas'}</p>}<p>{instruction}</p></section>;
}
