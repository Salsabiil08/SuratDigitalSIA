'use client';
import { useActionState } from 'react';
import { decideRegistration } from '@/server/actions/registration-admin';
type Choice={id:string;name:string};
export function RequestForm({id,unitId,positionId,units,positions}:{id:string;unitId:string|null;positionId:string|null;units:Choice[];positions:Choice[]}) {
 const [state,action,pending]=useActionState(decideRegistration,{});
 return <form action={action} className="flex flex-wrap gap-3 mt-3">
 <input type="hidden" name="requestId" value={id}/>
 <label>Unit<select name="unitId" defaultValue={unitId||''} className="block border rounded p-2"><option value="">Pilih unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
 <label>Jabatan<select name="positionId" defaultValue={positionId||''} className="block border rounded p-2"><option value="">Pilih jabatan</option>{positions.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
 <label>Catatan keputusan<input name="note" required minLength={3} maxLength={1000} className="block border rounded p-2"/></label>
 <button disabled={pending} name="action" value="APPROVE" className="rounded bg-red-700 text-white px-4 py-2">Aktifkan Akun</button>
 <button disabled={pending} name="action" value="REJECT" className="rounded border px-4 py-2">Tolak</button>
 {state.error&&<p role="alert" className="text-red-700 w-full">{state.error}</p>}
 {state.success&&<p role="status" className="text-green-700 w-full">{state.success}</p>}
 </form>;
}
