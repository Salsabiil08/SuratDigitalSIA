export function peerInternal(type:string,creatorLevel:number,recipientLevel:number){return type==='IN'&&creatorLevel>0&&creatorLevel===recipientLevel;}
export function assertPeerInternalAuthorization(type:string,creatorLevel:number,recipientLevel:number,plan:{signerIds?:string[];mandatoryApproverIds?:string[];additionalApproverIds?:string[];signatureCount?:number}){
 if(peerInternal(type,creatorLevel,recipientLevel)&&((plan.signatureCount||0)>0||(plan.signerIds?.length||0)>0||(plan.mandatoryApproverIds?.length||0)>0||(plan.additionalApproverIds?.length||0)>0))throw new Error('Surat internal sesama jabatan tidak memerlukan TTD atau persetujuan. Edit dan simpan draf tanpa pejabat penyetuju atau penandatangan.');
}
