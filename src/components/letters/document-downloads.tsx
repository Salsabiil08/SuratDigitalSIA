type Version = { file_format: string; version_kind: string; file_hash: string | null };

export function DocumentDownloads({ id, current, unsigned, signatureCount, fullVersionAccess }: {
  id: string; current: Version; unsigned?: Version; signatureCount: number; fullVersionAccess: boolean;
}) {
  const signed = current.version_kind === 'SIGNED';
  const separateBlank = fullVersionAccess && signed && unsigned?.file_hash && current.file_hash && unsigned.file_hash !== current.file_hash;
  return <div className="flex gap-4 flex-wrap">
    <a className="text-brand-red underline text-sm" href={`/api/letters/${id}/document?download=1`}>
      Unduh {current.file_format}{!signed && signatureCount > 0 ? ' (area TTD kosong)' : ''}
    </a>
    {separateBlank && <a className="text-brand-red underline text-sm" href={`/api/letters/${id}/document?download=1&blank=1`}>
      Unduh {current.file_format} tanpa TTD
    </a>}
  </div>;
}
