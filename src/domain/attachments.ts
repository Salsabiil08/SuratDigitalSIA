export const MAX_ATTACHMENT_BYTES=1024*1024;
export function validateAttachment(file:{name:string;size:number}){
 if(!file.name.trim()||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_ATTACHMENT_BYTES)throw new Error('Lampiran maksimal 1 MB per berkas dan tidak boleh kosong.');
 return file.name.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,250)||'Lampiran';
}
