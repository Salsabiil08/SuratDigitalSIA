export type MailboxFolder='INBOX'|'OUTBOX';
export type MailboxFilter='ALL'|'UNREAD'|'UNRECEIVED'|'RECEIVED';
export const MAILBOX_FILTERS:Record<MailboxFilter,string>={ALL:'Semua',UNREAD:'Belum Dibaca',UNRECEIVED:'Belum Diterima',RECEIVED:'Sudah Diterima'};
export interface MailboxQuery{filter:MailboxFilter;q:string;page:number;pageSize:number}
export interface MailboxRecipient{profile_id:string;name:string;role:'PRIMARY'|'CC';read_at:string|null;received_at:string|null;requires_response:boolean;replied_at?:string|null;commented_at?:string|null}
export interface MailboxItem{dispatch_id:string;letter_id:string;sender_id:string;sender_name:string;subject:string;official_number:string;sent_at:string;finalized_at:string|null;letter_status:string;recipients:MailboxRecipient[]}
export interface MailboxData{items:MailboxItem[];total:number;page:number;pageSize:number;pages:number}
export function mailboxQuery(raw:Record<string,unknown>={}):MailboxQuery{
 const number=(v:unknown,fallback:number)=>typeof v==='string'&&/^\d+$/.test(v)?Number(v):typeof v==='number'&&Number.isInteger(v)?v:fallback;
 const p=number(raw.page,1),s=number(raw.size??raw.pageSize,10);
 return{filter:typeof raw.filter==='string'&&Object.hasOwn(MAILBOX_FILTERS,raw.filter)?raw.filter as MailboxFilter:'ALL',q:typeof raw.q==='string'?raw.q.trim().slice(0,100):'',page:p>0&&p<=100000?p:1,pageSize:[10,20,50].includes(s)?s:10};
}
export function mailboxPath(folder:MailboxFolder){return folder==='INBOX'?'/kotak-masuk':'/kotak-keluar';}
export function mailboxHref(folder:MailboxFolder,query:MailboxQuery){const q=new URLSearchParams({filter:query.filter,page:String(query.page),size:String(query.pageSize)});if(query.q)q.set('q',query.q);return`${mailboxPath(folder)}?${q}`;}
export function recipientSummary(recipients:MailboxRecipient[]){const primary=recipients.filter(r=>r.role==='PRIMARY');return{total:recipients.length,read:recipients.filter(r=>!!r.read_at).length,primary:primary.length,received:primary.filter(r=>!!r.received_at).length,cc:recipients.filter(r=>r.role==='CC').length};}
export function mailboxDate(value:string|null){return value?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))+' WIB':null;}
