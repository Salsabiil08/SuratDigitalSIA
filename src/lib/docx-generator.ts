import {richTextDocx} from './rich-docx';
import {billingLetterBody} from './billing-docx';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

export interface SignerInfo {
  name: string;
  title: string;
  role?: string;
}

export interface LetterDocxData {
  r05?: {
    kind: 'INTERNAL' | 'EXTERNAL' | 'BILLING';
    city?: string;
    senderName: string;
    senderTitle: string;
  };
  billing?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    fromTitle: string;
    toTitle: string;
    items: import('../domain/billing').BillingItem[];
  };
  officialNumber?: string;
  letterDate?: string;
  subject?: string;
  recipientName?: string;
  recipientOrg?: string;
  contentHtml?: string;
  contentText?: string;
  signerName?: string;
  signerTitle?: string;
  fromUnit?: string;
  signatureCount?: number; // 0 = Internal, 1 = Eksternal (1 ttd), 2 = Tagihan (2 ttd)
  signers?: SignerInfo[];
  signaturePlaceholders?: boolean;
}

function escapeXml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Menghasilkan file Word (.docx) berbasis template resmi PT Semen Indonesia Aceh (KOP Asli).
 */
export async function generateLetterDocx(data: LetterDocxData): Promise<Buffer> {
  const templatePath = path.resolve(process.cwd(), 'public/templates/template-kop-sia.docx');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Master template KOP tidak ditemukan di ${templatePath}`);
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  const fontName = 'SIG Text';

  // 1. Pastikan fontTable.xml memiliki SIG Text
  let fontTableXml = await zip.file('word/fontTable.xml')?.async('string');
  if (fontTableXml && !fontTableXml.includes('SIG Text')) {
    const insertPos = fontTableXml.lastIndexOf('</w:fonts>');
    if (insertPos !== -1) {
      const sigFontXml = `<w:font w:name="SIG Text"><w:panose1 w:val="020B0604020202020204"/><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>`;
      fontTableXml = fontTableXml.slice(0, insertPos) + sigFontXml + fontTableXml.slice(insertPos);
      zip.file('word/fontTable.xml', fontTableXml);
    }
  }

  // 2. Baca document.xml asli untuk mengambil sectPr (header & footer bawaan kop asli)
  const originalDocXml = (await zip.file('word/document.xml')?.async('string')) || '';
  const sectPrMatch = originalDocXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/i);

  const defaultSectPr = `
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId12"/>
      <w:footerReference w:type="default" r:id="rId13"/>
      <w:type w:val="continuous"/>
      <w:pgSz w:w="11906" w:h="16838" w:code="9"/>
      <w:pgMar w:top="1736" w:right="1133" w:bottom="720" w:left="1276" w:header="706" w:footer="414" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>`;

  const sectPrXml = sectPrMatch ? sectPrMatch[0] : defaultSectPr;

  // Data variabel surat
  const officialNumber = data.officialNumber || '[Akan terbit melalui sistem SIADocs setelah disetujui]';
  const legacyDate = data.letterDate || 'Aceh Besar, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const letterDate = data.r05?.kind === 'EXTERNAL'
    ? [data.r05.city?.trim(), data.letterDate].filter(Boolean).join(', ')
    : data.r05 ? data.letterDate || '' : legacyDate;
  const subject = data.subject || '[Tuliskan Perihal Surat Resmi di Sini]';
  const recipientName = data.recipientName || '[Nama Penerima / Jabatan]';
  const recipientOrg = data.recipientOrg || '[Instansi / Unit Kerja Perusahaan]';
  const signerName = data.signerName || '[Nama Penandatangan Sah]';
  const signerTitle = data.signerTitle || (data.fromUnit ? `Senior Manager / Pejabat ${data.fromUnit}` : 'Senior Manager / Direktur Utama');

  const contentBodyXml = data.contentText !== undefined
    ? data.contentText.split('\n').map(line=>`<w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('')
    : data.contentHtml
    ? richTextDocx(data.contentHtml, fontName)
    : `
      <w:p>
        <w:pPr>
          <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
          <w:rPr>
            <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
            <w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
            <w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
          <w:t>Silakan susun isi naskah surat dinas Anda di Word menggunakan template kop resmi PT Semen Indonesia Aceh ini.</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
          <w:rPr>
            <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
            <w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
            <w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
          <w:t>Setelah dokumen selesai disusun dan siap ditandatangani, Anda dapat menyimpannya sebagai format DOCX atau PDF dan mengunggahnya kembali ke sistem SIADocs sebagai dokumen bukti bernomor resmi.</w:t>
        </w:r>
      </w:p>`;

  // Rakit w:body lengkap
  const bodyXml = data.billing ? billingLetterBody(data, sectPrXml) : `
    <w:body>
      <!-- Ruang Meta Surat (Nomor, Lampiran, Perihal, Tanggal) -->
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="9497" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Nomor</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>:</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="5097" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(officialNumber)}</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(letterDate)}</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Lampiran</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>:</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="8097" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>-</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="160"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Perihal</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="160"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>:</w:t></w:r>
            </w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="8097" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="160"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(subject)}</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>

      <!-- Kepada Yth. -->
      <w:p>
        <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Kepada Yth.</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:after="20"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(recipientName)}</w:t></w:r>
      </w:p>
      ${
        recipientOrg
          ? `
      <w:p>
        <w:pPr><w:spacing w:after="20"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(recipientOrg)}</w:t></w:r>
      </w:p>`
          : ''
      }
      <w:p>
        <w:pPr><w:spacing w:after="180"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>di Tempat</w:t></w:r>
      </w:p>

      ${data.r05 ? '' : `
      <!-- Salam Pembuka -->
      <w:p>
        <w:pPr><w:spacing w:after="160"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Dengan hormat,</w:t></w:r>
      </w:p>

` }
      <!-- Naskah Isi Surat -->
      ${contentBodyXml}

      ${data.r05 ? '' : `
      <!-- Penutup -->
      <w:p>
        <w:pPr><w:spacing w:before="140" w:after="260"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Demikian surat ini kami sampaikan, atas perhatian dan kerja samanya kami ucapkan terima kasih.</w:t></w:r>
      </w:p>

` }
      <!-- Ruang Tanda Tangan Sesuai Jumlah Penandatangan (0, 1, atau 2) -->
      ${
        data.signatureCount === 0
          ? (data.r05?.kind === 'INTERNAL' ? `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="260"/></w:pPr><w:r><w:t>${escapeXml(data.r05.senderName)}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>${escapeXml(data.r05.senderTitle)}</w:t></w:r></w:p>` : '')
          : data.signatureCount === 2
          ? `
      <!-- 2 Tanda Tangan: Surat Penagihan / 2 Pejabat Berdampingan -->
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="9497" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <!-- Penandatangan 1 (Kiri) -->
          <w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(data.signers?.[0]?.role || 'Disiapkan / Diverifikasi oleh,')}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="720"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>PT SEMEN INDONESIA ACEH</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:u w:val="single"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(data.signers?.[0]?.name || signerName || 'Siti Rahma')}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:color w:val="444444"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(data.signers?.[0]?.title || 'Senior Manager Finance')}</w:t></w:r>
            </w:p>
          </w:tc>

          <!-- Jarak Pemisah -->
          <w:tc><w:tcPr><w:tcW w:w="297" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          </w:tc>

          <!-- Penandatangan 2 (Kanan) -->
          <w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(data.signers?.[1]?.role || 'Mengetahui / Menyetujui,')}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="720"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>PT SEMEN INDONESIA ACEH</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:u w:val="single"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(data.signers?.[1]?.name || 'Budi Hartono')}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:color w:val="444444"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(data.signers?.[1]?.title || 'Direktur Utama')}</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>`
          : `
      <!-- 1 Tanda Tangan: Surat Eksternal KRE / Tunggal -->
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="9497" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="5200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          </w:tc>
          <w:tc><w:tcPr><w:tcW w:w="4297" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="22"/></w:rPr><w:t>Hormat kami,</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="720"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>PT SEMEN INDONESIA ACEH</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:u w:val="single"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(signerName)}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:color w:val="444444"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(signerTitle)}</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>`
      }

      ${sectPrXml}
    </w:body>`;

  // Rekonstruksi document.xml dengan w:body baru
  let finalBody = bodyXml;
  if (data.signaturePlaceholders && data.signatureCount && !data.billing) {
    let slot = 0;
    finalBody = finalBody.replace(/(<w:p><w:pPr><w:jc w:val="center"\/><w:spacing w:after="720"\/>[\s\S]*?<\/w:p>)/g, (block) => {
      slot++;
      return block.replace('w:after="720"', 'w:after="80"') + `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${slot === 1 ? '<w:r><w:t>{{STAMP}}</w:t></w:r>' : ''}<w:r><w:t>{{SIGNATURE_${slot}}}</w:t></w:r></w:p>`;
    });

  }
  const newDocXml = originalDocXml.replace(/<w:body>[\s\S]*?<\/w:body>/i, finalBody);
  zip.file('word/document.xml', newDocXml);

  // Buat berkas DOCX terkompresi
  const outputBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return outputBuffer;
}
