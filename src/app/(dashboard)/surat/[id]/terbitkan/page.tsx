"use client";
import {ActionNotice} from "@/components/ui/action-notice";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getWorkflowLetter } from "@/server/actions/workflow";
import { issueLetterNumberAction } from "@/server/actions/approvals";

export default function KonfirmasiPenerbitanPage() {
  const params = useParams();
  const router = useRouter();
  const letterId = params?.id as string;

  const [record,setRecord]=React.useState<Awaited<ReturnType<typeof getWorkflowLetter>>|null>(null);
  React.useEffect(()=>{let active=true;getWorkflowLetter(letterId).then(v=>{if(active)setRecord(v);}).catch(()=>{if(active)setErrorMsg('Syarat penerbitan belum dapat diambil.');});return()=>{active=false;};},[letterId]);
  const letter=record?.letter;
  const currentApprovals=record?.approvals.filter(a=>a.version_id===letter?.approval_plan_version&&a.cycle===letter?.approval_cycle)||[];
  const approved=currentApprovals.filter(a=>a.status==='APPROVED').length;
  const needed=letter?.approval_plan?.length;
  const hasVersion=!!record?.versions.some(v=>v.id===letter?.current_version_id&&!!v.file_hash);
  const ready=!!record?.isCreator&&hasVersion&&(letter?.status==='READY_TO_ISSUE'&&needed!=null&&approved===needed||letter?.status==='NUMBERED');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [issuedNumber, setIssuedNumber] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleIssueNumber = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await issueLetterNumberAction(letterId);
      if (res.success && res.officialNumber) {
        setIssuedNumber(res.officialNumber);
      } else {
        setErrorMsg(res.error || "Gagal menerbitkan nomor surat.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (issuedNumber) {
      navigator.clipboard.writeText(issuedNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link
          href={`/surat/${letterId}`}
          className="text-xs font-semibold text-brand-red hover:underline"
        >
          &larr; Kembali ke Detail Surat
        </Link>
      </div>

      <PageHeader title="Konfirmasi & Terbitkan Nomor Surat" />

      {errorMsg && <ActionNotice kind={"error"}>{errorMsg}</ActionNotice>}

      {issuedNumber ? (
        /* Tampilan Sukses Setelah Nomor Diterbitkan (Satu Transaksi) */
        <Card className="p-8 text-center flex flex-col items-center gap-4 bg-gradient-to-b from-white to-emerald-50/40 border-emerald-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 text-3xl flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 m-0">
              Nomor Resmi Berhasil Diterbitkan!
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Surat sudah memiliki nomor resmi. Nomor ini tersimpan dan tidak
              dapat digunakan untuk surat lain.
            </p>
          </div>

          <div className="my-3 p-4 bg-white border border-emerald-300 rounded-2xl shadow-sm flex flex-col items-center gap-2">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
              Nomor Resmi Terbit:
            </span>
            <span className="font-mono text-2xl font-extrabold text-neutral-950 tracking-wide select-all">
              {issuedNumber}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleCopy}
            >
              {copied ? "✓ Berhasil Disalin!" : "Salin Nomor"}
            </Button>
            <a
              href={`/api/kop/${letterId}/unduh`}
              download={`KOP_RESMI_${issuedNumber.replace(/[\/\.\s]/g, "_")}.docx`}
            >
              <Button type="button" variant="secondary" size="md">
                Unduh Word Kop Bernomor (.docx)
              </Button>
            </a>
            <Link href={`/surat/${letterId}`}>
              <Button type="button" variant="outline" size="md">
                Lihat Detail Surat
              </Button>
            </Link>
          </div>

          <div className="text-[11px] text-neutral-400 mt-4 max-w-md">
            SIADocs tidak menyisipkan nomor secara otomatis ke dokumen. Silakan
            salin nomor resmi di atas atau unduh template kop bernomor.
          </div>
        </Card>
      ) : (
        /* Form Konfirmasi Penerbitan Nomor */
        <div className="flex flex-col gap-6">
          <Card className="p-6 border-l-4 border-l-brand-red space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Ringkasan Syarat Penerbitan Nomor
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#EEEEEA]">
                <span className="text-neutral-500 text-xs">
                  Persetujuan Wajib:
                </span>
                <span className="font-semibold text-xs">{needed==null?'Pengajuan perlu disiapkan':`${approved} dari ${needed} keputusan selesai pada versi pengajuan`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EEEEEA]">
                <span className="text-neutral-500 text-xs">
                  Dokumen Bukti Surat:
                </span>
                <span className="font-semibold text-xs">{hasVersion?'Versi dokumen tercatat; integritas diperiksa server saat penerbitan':'Versi dokumen belum tersedia'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EEEEEA]">
                <span className="text-neutral-500 text-xs">
                  Status Prasyarat:
                </span>
                <Chip variant={ready?"blue":"amber"}>{ready?"Prasyarat tercatat":"Belum siap diterbitkan"}</Chip>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EEEEEA]">
                <span className="text-neutral-500 text-xs">
                  Zona Waktu Operasional:
                </span>
                <span className="text-neutral-800 text-xs font-medium">
                  Asia/Jakarta (WIB)
                </span>
              </div>
            </div>
          </Card>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <b>Peringatan Integritas Nomor:</b> Penomoran bersifat unik, atomik,
            dan nomornya tidak dapat dipakai ulang atau diedit. Sekali diterbitkan, nomor
            surat akan tercatat permanen pada sistem dan tidak akan pernah
            digunakan kembali sekalipun surat dibatalkan.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/surat/${letterId}`}>
              <Button type="button" variant="secondary" size="md">
                Batal
              </Button>
            </Link>
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isLoading}
              disabled={!ready}
              onClick={handleIssueNumber}
            >
              Konfirmasi & Terbitkan Nomor Sekarang
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
