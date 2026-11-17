import { NextResponse } from 'next/server';
import { generateLetterDocx } from '@/lib/docx-generator';

export async function GET() {
  try {
    const docxBuffer = await generateLetterDocx({
      officialNumber: '00___/___/SIA/11.2026 (Nomor Resmi Terbit Melalui SIADocs)',
      subject: '[Tuliskan Perihal Surat Resmi di Sini]',
      recipientName: '[Nama Penerima / Jabatan]',
      recipientOrg: '[Instansi / Unit Kerja Perusahaan]',
      signerName: '[Nama Penandatangan Sah]',
      signerTitle: 'Senior Manager / Pejabat Berwenang',
      contentHtml: `
        <p>Silakan susun isi naskah surat dinas Anda menggunakan template resmi PT Semen Indonesia Aceh ini.</p>
        <p>Dokumen ini menggunakan tata letak kop surat resmi dan font SIG Text yang terstandar.</p>
        <p>Setelah dokumen selesai disusun dan siap ditandatangani, Anda dapat mengunggahnya kembali ke sistem SIADocs sebagai dokumen persuratan bernomor resmi.</p>
      `,
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="KOP_SURAT_RESMI_PT_SEMEN_INDONESIA_ACEH.docx"',
      },
    });
  } catch (error) {
    console.error('Gagal mengunduh template kop surat docx:', error);
    return new NextResponse('Gagal membuat berkas Word kop surat', { status: 500 });
  }
}
