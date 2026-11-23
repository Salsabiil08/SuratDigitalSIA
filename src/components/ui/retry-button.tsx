'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from './button';
export function RetryButton({label='Coba Lagi'}:{label?:string}){const router=useRouter();const [busy,start]=useTransition();return <Button variant="secondary" isLoading={busy} loadingLabel="Memuat kembali…" onClick={()=>start(()=>router.refresh())}>{label}</Button>;}
