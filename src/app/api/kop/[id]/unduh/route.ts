import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateLetterDocx } from '@/lib/docx-generator';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const letterId = params.id;
    const supabase = createAdminClient();

    const { data: letter } = await supabase
      .from('letters')
      .select(`
        id,
        official_number,
        subject,
        recipient_external_name,
        recipient_external_org,
        issued_at,
        created_at,
        signer_id,
        letter_types (code, name, default_signature_count),
        unit:organizational_units!creator_unit_id (name, code),
        signer:profiles!signer_id (full_name)
      `)
      .eq('id', letterId)
      .maybeSingle();

    // Ambil daftar penandatangan dari signature_requests jika ada
    let signers: { name: string; title: string; role?: string }[] = [];
    let signatureCount = 1;

    const typeCode = (letter as any)?.letter_types?.code;
    if (typeCode === 'IN') {
      signatureCount = 0;
    } else if (typeCode === 'Tag') {
      signatureCount = 2;
    } else {
      signatureCount = 1;
    }

    if (signatureCount > 0) {
      const { data: sigReqs } = await supabase
        .from('signature_requests')
        .select(`
          id,
          sign_order,
          signer_role,
          signer:profiles!signer_id (full_name)
        `)
        .eq('letter_id', letterId)
        .order('sign_order', { ascending: true });

      if (sigReqs && sigReqs.length > 0) {
        signers = sigReqs.map((sr) => ({
          name: (sr.signer as any)?.full_name || 'Pejabat Berwenang',
          title: sr.signer_role || 'Direktur Utama',
          role: sr.sign_order === 1 && signatureCount === 2 ? 'Disiapkan / Diverifikasi oleh,' : 'Mengetahui / Menyetujui,',
        }));
      } else if (signatureCount === 1) {
        signers = [
          {
            name: (letter as any)?.signer?.full_name || 'Budi Hartono',
            title: 'Direktur Utama',
          },
        ];
      } else if (signatureCount === 2) {
        signers = [
          {
            name: 'Siti Rahma',
            title: 'Senior Manager Finance',
            role: 'Disiapkan / Diverifikasi oleh,',
          },
          {
            name: 'Budi Hartono',
            title: 'Direktur Utama',
            role: 'Mengetahui / Menyetujui,',
          },
        ];
      }
    }

    // Ambil naskah isi surat dari letter_versions jika ada
    let contentHtml = '';
    if (letter) {
      const { data: version } = await supabase
        .from('letter_versions')
        .select('content_html')
        .eq('letter_id', letter.id)
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (version?.content_html) {
        contentHtml = version.content_html;
      }
    }

    const officialNumber = letter?.official_number || '00105-IN/ACH/SIA/11.2026';
    const subject = letter?.subject || 'Surat Undangan Rapat Kedinasan';
    const recipientName = letter?.recipient_external_name || 'Bapak/Ibu Pimpinan Unit Kerja';
    const recipientOrg = letter?.recipient_external_org || '';
    const dateStr = letter?.issued_at
      ? 'Aceh Besar, ' + new Date(letter.issued_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Aceh Besar, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const docxBuffer = await generateLetterDocx({
      officialNumber,
      subject,
      recipientName,
      recipientOrg,
      letterDate: dateStr,
      contentHtml: contentHtml || undefined,
      signatureCount,
      signers: signers.length > 0 ? signers : undefined,
      signerName: signers[0]?.name || (letter as any)?.signer?.full_name || 'Staff Pengirim',
      signerTitle: signers[0]?.title || (letter as any)?.unit?.name || 'Unit Kerja SIA',
    });

    const safeFilename = `KOP_RESMI_${officialNumber.replace(/[\/\.\s]/g, '_')}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (error) {
    console.error('Gagal membuat berkas Word kop bernomor docx:', error);
    return new NextResponse('Gagal membuat berkas Word kop bernomor', { status: 500 });
  }
}
