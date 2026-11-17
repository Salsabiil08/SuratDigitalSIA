import { LetterEditor } from '@/components/letters/letter-editor';
export default function Page({params}:{params:{id:string}}){return <LetterEditor id={params.id}/>;}
