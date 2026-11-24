import {randomUUID} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {createHash} from 'node:crypto';
import {validateAttachment} from '@/domain/attachments';
export const ATTACHMENT_BUCKET='letter-attachments';
export async function storeAttachment(actor:string,file:File){
 const name=validateAttachment(file),bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.length!==file.size)throw new Error('Ukuran lampiran tidak sesuai.');
 const path=`${actor}/${randomUUID()}.bin`,hash=createHash('sha256').update(bytes).digest('hex');
 const {error}=await createAdminClient().storage.from(ATTACHMENT_BUCKET).upload(path,bytes,{contentType:'application/octet-stream',upsert:false});
 if(error)throw new Error('Lampiran belum tersimpan. Coba kembali.');
 return {path,hash,bucket:ATTACHMENT_BUCKET,format:'BINARY' as const,name,mime:'application/octet-stream',size:file.size};
}
export async function removeAttachments(files:{path:string;bucket?:string}[]){for(const f of files)await createAdminClient().storage.from(f.bucket||ATTACHMENT_BUCKET).remove([f.path]);}
