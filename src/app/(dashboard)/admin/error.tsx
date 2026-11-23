'use client';
import {RecoveryState} from '@/components/ui/recovery-state';
export default function AdminError({reset}:{reset:()=>void}){return <div className="space-y-4"><RecoveryState title="Data belum dapat dimuat" message="Halaman administrasi belum dapat ditampilkan. Silakan coba kembali."/><button type="button" onClick={reset} className="rounded-lg border px-4 py-2">Coba Lagi</button></div>;}
