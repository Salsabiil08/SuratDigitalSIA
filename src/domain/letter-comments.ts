export interface LetterComment {id:string;authorId:string;authorName:string;body:string;createdAt:string}
export interface CommentContext {canRead:boolean;canComment:boolean;items:LetterComment[];total:number;recipientCommented:boolean}
export function commentBody(value:string){const body=value.trim();if(!body||value.length>5000)throw new Error('Isi komentar 1 sampai 5000 karakter.');return body;}
export function responseLabel(commented:boolean,replied:boolean){return commented&&replied?'Sudah ditanggapi melalui komentar dan surat':commented?'Sudah ditanggapi melalui komentar':replied?'Surat balasan resmi telah dikirim':'Tanggapan dapat berupa komentar atau surat; sesuai kebutuhan.';}
