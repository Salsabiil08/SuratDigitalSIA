'use client';
import {useRef,useState} from 'react';
import {changePasswordAction} from '@/server/actions/password';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Field,Input} from '@/components/ui/field';
import {Button} from '@/components/ui/button';
import {ActionNotice} from '@/components/ui/action-notice';
export function PasswordForm(){
 const [busy,setBusy]=useState(false),[result,setResult]=useState<{success?:boolean;error?:string}|null>(null);
 const active=useRef(false),form=useRef<HTMLFormElement>(null);
 async function submit(data:FormData){
  if(active.current)return;active.current=true;setBusy(true);setResult(null);
  try{const response=await changePasswordAction(data);setResult(response);if(response.success)form.current?.reset();}
  catch{setResult({error:'Kata sandi belum dapat diubah. Coba lagi.'});}
  finally{active.current=false;setBusy(false);}
 }
 return <Card><CardHeader><CardTitle>Ganti Kata Sandi</CardTitle></CardHeader><CardContent>
 {result?.error&&<ActionNotice eventKey={result}>{result.error}</ActionNotice>}
 {result?.success&&<ActionNotice eventKey={result} kind="success">Kata sandi berhasil diubah.</ActionNotice>}
 <form ref={form} action={submit} className="space-y-4">
 <Field label="Kata Sandi Saat Ini" htmlFor="current-password" required><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={busy}/></Field>
 <Field label="Kata Sandi Baru" htmlFor="new-password" required hint="Minimal 8 karakter."><Input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy}/></Field>
 <Field label="Konfirmasi Kata Sandi Baru" htmlFor="confirm-password" required><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy}/></Field>
 <Button type="submit" isLoading={busy} loadingLabel="Menyimpan…">Simpan Kata Sandi</Button>
 </form></CardContent></Card>;
}
