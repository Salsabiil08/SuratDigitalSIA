export function cancellationFeedback(data:{userId:string;letter:{status:string};cancellations:{status:string;cancellation_authorizations?:{authorizer_id:string;decision:string|null}[]}[]}){
 const r=data.cancellations[0];
 if(data.letter.status==='CANCELLED')return 'Surat telah dibatalkan.';
 if(!r)return undefined;
 if(r.status==='DECLINED')return 'Permohonan pembatalan ditolak. Surat tetap berlaku.';
 if(r.status==='EXECUTED')return 'Surat telah dibatalkan.';
 if(r.status==='PENDING'){
  if(r.cancellation_authorizations?.some(a=>a.authorizer_id===data.userId&&!a.decision))return 'Permohonan pembatalan menunggu persetujuan Anda.';
  const approved=r.cancellation_authorizations?.filter(a=>a.decision==='APPROVED').length||0;
  return approved?'Pembatalan telah disetujui sebagian dan menunggu otorisasi berikutnya.':'Permohonan pembatalan masih menunggu persetujuan.';
 }
 return undefined;
}
