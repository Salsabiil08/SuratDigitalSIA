export function letterNextStep(l:{status:string;manual_number_reservation_id?:string|null;review_status?:string;required_signature_count:number;signature_mode:string;signature_status?:string;finalized_at?:string|null;type?:{category?:string}},a:{creator:boolean;review:boolean;approval:boolean;signing:boolean;sent:boolean;recipient:boolean;received:boolean}){
  if(l.status==='CANCELLED'||l.status==='REJECTED')return {title:'Surat '+(l.status==='CANCELLED'?'dibatalkan':'ditolak'),description:'Periksa riwayat dan catatan keputusan.',target:'history'};
  if(a.sent)return {title:a.recipient&&!a.received?'Konfirmasi penerimaan':'Surat sudah dikirim',description:a.recipient&&!a.received?'Baca surat, lalu konfirmasikan bahwa Anda menerimanya.':'Lihat status setiap penerima pada bagian pengiriman.',target:'delivery'};
  if(a.approval)return {title:'Berikan persetujuan',description:'Baca pratinjau, lalu pilih Setujui, Minta Revisi, atau Tolak.',target:'preview'};
  if(a.signing)return {title:'Tandatangani surat',description:'Pilih gambar TTD, periksa hasilnya, lalu simpan tanda tangan.',target:'signing'};
  if(l.status==='IN_REVIEW')return {title:'Menunggu persetujuan',description:'Pejabat yang ditunjuk perlu memberikan keputusan. Status diperbarui otomatis.'};
  if(a.creator&&['DRAFT','REVISION_REQUESTED'].includes(l.status))return {title:'Periksa dan ajukan surat',description:'Koreksi bila perlu, baca pratinjau, lalu tekan Ajukan Surat.',target:'preview'};
  if(a.creator&&l.status==='READY_TO_ISSUE'&&l.manual_number_reservation_id)return {title:'Lanjutkan dokumen bernomor',description:'Persetujuan selesai. Lanjutkan dengan nomor yang sudah diambil.',target:'number'};
  if(a.creator&&l.status==='READY_TO_ISSUE')return {title:'Terbitkan nomor surat',description:'Persyaratan persetujuan terpenuhi. Terbitkan nomor melalui tombol di bawah.',target:'number'};
  if(!l.finalized_at&&l.status==='NUMBERED'&&l.signature_mode==='IN_APP'&&l.required_signature_count>0&&l.signature_status!=='UPLOADED')return {title:'Menunggu tanda tangan',description:'Penandatangan membuka menu Tanda Tangan. Status akan diperbarui otomatis.'};
  if(a.creator&&l.finalized_at&&l.type?.category&&l.type.category!=='INTERNAL')return {title:'Unduh surat untuk dikirim kepada pihak luar',description:'Pengiriman kepada pihak luar dilakukan di luar SIADocs. Gunakan pilihan Unduh Surat pada pratinjau.',target:'preview'};
  if(a.creator&&l.finalized_at)return {title:'Kirim surat',description:'Dokumen sudah terkunci. Konfirmasikan penerima, lalu kirim secara resmi.',target:'delivery'};
  if(a.creator&&l.status==='NUMBERED')return {title:'Finalisasi dokumen',description:'Periksa hasil pratinjau, lalu kunci dokumen sebelum dikirim.',target:'finalize'};
  return {title:'Status surat',description:'Tindakan yang tersedia mengikuti kewenangan akun dan tahap surat.'};
}
