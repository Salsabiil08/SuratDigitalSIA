import JSZip from 'jszip';

/** A corrected presentation copy; never alter the version or dispatch evidence. */
export async function correctLegacyInternalOutput(bytes: Uint8Array, letter: {
  type?: { category?: string }; required_signature_count?: number;
}, format: string): Promise<Uint8Array> {
  if (letter.type?.category !== 'INTERNAL' || letter.required_signature_count !== 0 || format !== 'DOCX') return bytes;
  const zip = await JSZip.loadAsync(bytes);
  const part = zip.file('word/document.xml');
  if (!part) return bytes;
  const xml = await part.async('string');
  // Only the old generated zero-signature block, immediately following the closing.
  // Do not remove arbitrary tables, imported signatures, or content mentioning a sender.
  const pattern = /<!-- 0 Tanda Tangan: Surat Internal \(Hanya Unit Pengirim, Tanpa Pengesahan Pejabat\) -->\s*(<w:tbl>[\s\S]*?<\/w:tbl>)/g;
  const matches = [...xml.matchAll(pattern)];
  if (matches.length !== 1) return bytes;
  const match = matches[0];
  if (!match || !match[1] || match.index === undefined) return bytes;
  const table = match[1];
  if (!table.includes('<w:t>Unit Pengirim,</w:t>') || !table.includes('<w:t>PT SEMEN INDONESIA ACEH</w:t>') || /<w:drawing|<w:pict|SIGNATURE_|STAMP|<w:tbl>.*<w:tbl>/s.test(table)) return bytes;
  const before = xml.slice(0, match.index);
  if (!/<!-- Ruang Tanda Tangan Sesuai Jumlah Penandatangan \(0, 1, atau 2\) -->\s*$/.test(before)) return bytes;
  zip.file('word/document.xml', xml.slice(0, match.index) + xml.slice(match.index! + match[0].length));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
