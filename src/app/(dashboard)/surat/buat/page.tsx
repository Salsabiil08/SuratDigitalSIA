import { LetterEditor } from "@/components/letters/letter-editor";
export default function Page({searchParams}:{searchParams:{disposisi?:string}}){return <LetterEditor dispositionId={searchParams.disposisi}/>;}
