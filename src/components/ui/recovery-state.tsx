import Link from 'next/link';
export function RecoveryState({title,message,href='/',label='Ke Dashboard'}:{title:string;message:string;href?:string;label?:string}){
 return <section className="rounded-xl border bg-white p-6 space-y-4" aria-label={title}><h1 className="text-xl font-bold">{title}</h1><p className="text-sm text-neutral-700">{message}</p><div className="flex flex-wrap gap-4"><Link className="rounded-lg bg-red-700 px-4 py-2 text-white text-sm" href={href}>{label}</Link>{href!=='/'&&<Link href="/" className="py-2 text-sm text-red-800 underline">Ke Dashboard</Link>}</div></section>;
}
