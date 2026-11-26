import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { inspectDocument } from '@/lib/letter-document';

const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

export async function validateLetterhead(bytes:Uint8Array) {
  await inspectDocument(bytes,'DOCX',0,[],false,false);
  const zip=await JSZip.loadAsync(bytes);
  const body=await zip.file('word/document.xml')?.async('string');
  if(!body?.includes('<w:headerReference'))throw new Error('DOCX kop harus menyimpan kop di bagian header Word.');
  const relations=await Promise.all(zip.file(/\.rels$/).map(file=>file.async('string')));
  if(relations.some(xml=>/TargetMode\s*=\s*["']External["']/i.test(xml)))throw new Error('Gunakan kop dengan gambar lokal di dalam DOCX.');
}

export async function getLetterhead(code:string) {
  const db=createAdminClient();
  const {data,error}=await db.from('letter_templates')
    .select('template_path,template_hash,letter_types!inner(code)')
    .eq('letter_types.code',code).eq('is_active',true).not('template_path','is',null).maybeSingle();
  if(error)throw new Error('Master kop belum dapat dimuat.');
  if(!data)return undefined;
  const object=await db.storage.from('letter-documents').download(data.template_path);
  if(object.error||!object.data)throw new Error('Berkas master kop tidak tersedia.');
  const bytes=new Uint8Array(await object.data.arrayBuffer());
  if(digest(bytes)!==data.template_hash)throw new Error('Berkas master kop tidak sesuai catatan.');
  return bytes;
}
