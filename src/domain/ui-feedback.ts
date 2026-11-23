export function readableMessage(message:string){
 if(/\{\{STAMP\}\}/.test(message))return 'Area stempel belum dapat digunakan. Minta pembuat memperbaiki dokumen sebelum melanjutkan.';
 if(/\{\{SIGNATURE_\d+\}\}/.test(message))return 'Area tanda tangan belum dapat digunakan. Minta pembuat memperbaiki dokumen sebelum melanjutkan.';
 if(/Supabase|Storage|PGRST|SQLSTATE|constraint|relation .*does not exist|Failed to fetch|NetworkError|permission denied|row-level security/i.test(message))return 'Tindakan belum berhasil. Periksa koneksi atau kewenangan Anda, lalu coba kembali.';
 return message;
}
export function fieldMessage(v:ValidityState,element:{tagName:string;minLength?:number;maxLength?:number;min?:string;max?:string}){
 if(v.valueMissing)return element.tagName==='SELECT'?'Pilih salah satu pilihan terlebih dahulu.':'Isi bagian ini terlebih dahulu.';
 if(v.typeMismatch)return 'Isi alamat atau nilai dengan format yang benar.';
 if(v.tooShort)return `Isi sekurang-kurangnya ${element.minLength} karakter.`;
 if(v.tooLong)return `Isi paling banyak ${element.maxLength} karakter.`;
 if(v.rangeUnderflow)return `Isi nilai minimal ${element.min}.`;
 if(v.rangeOverflow)return `Isi nilai maksimal ${element.max}.`;
 if(v.stepMismatch)return 'Isi angka sesuai kelipatan yang diperbolehkan.';
 return 'Periksa kembali isian ini.';
}
export const NOTICE_DURATION={success:4000,info:6000,error:8000};
