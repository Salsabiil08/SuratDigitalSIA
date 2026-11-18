import {PreparedMailbox} from '@/components/mailbox/prepared-mailbox';
export const dynamic='force-dynamic';
export default function Page({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){return <PreparedMailbox folder="INBOX" searchParams={searchParams}/>;}
