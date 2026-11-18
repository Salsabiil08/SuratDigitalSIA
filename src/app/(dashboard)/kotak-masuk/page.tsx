import {PreparedMailbox} from '@/components/mailbox/prepared-mailbox';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <PreparedMailbox folder="INBOX" searchParams={await searchParams}/>;}
