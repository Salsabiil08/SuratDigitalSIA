import {DraftInput,jakartaDate} from './workflow';
import {plainTextHtml} from './rich-text';
export interface ReplySeed{dispatchId:string;senderId:string;officialNumber:string;subject:string;categoryCode:string}
export interface ReplyLink{id:string;direction:'ORIGIN'|'REPLY';letterId:string;subject:string;officialNumber:string|null;status:string;createdAt:string;actorId:string;actorName:string;sentAt:string|null}
export interface ReplyContext{seed:ReplySeed|null;links:ReplyLink[];recipients:{profileId:string;repliedAt:string|null}[]}
export function replyDraft(seed:ReplySeed,key:string):DraftInput{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))throw new Error('Kunci pembuatan balasan tidak valid.');
 return {source:'CREATE',letterTypeCode:'IN',categoryCode:seed.categoryCode,subject:`Balasan: ${seed.subject}`.slice(0,250),letterDate:jakartaDate(),recipientUserId:seed.senderId,
 content:plainTextHtml(`Menanggapi surat nomor ${seed.officialNumber} tentang ${seed.subject}.\n\nLengkapi isi balasan sebelum mengajukan pemeriksaan dan persetujuan.`),contentFormat:'HTML',signatureMode:'IN_APP',signerIds:[],areas:[],replyToDispatchId:seed.dispatchId,replyKey:key};
}
