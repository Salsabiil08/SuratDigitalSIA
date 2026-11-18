/** Tautan navigasi tidak memberi hak baca. Halaman/API selalu mengecek Auth/RLS. */
export function notificationHref(item:{letter_id?:string|null;disposition_id?:string|null;event_type?:string}){
 if(item.disposition_id)return'/disposisi';
 if(item.letter_id){const origin=item.event_type==='INTERNAL_SENT'?'?asal=kotak-masuk':item.event_type==='INTERNAL_RECEIVED'?'?asal=kotak-keluar':'';return`/surat/${encodeURIComponent(item.letter_id)}${origin}`;}
 return'/notifikasi';
}
