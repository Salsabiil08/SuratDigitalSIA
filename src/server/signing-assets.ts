import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateSigningPng } from '@/lib/letter-document';
import { ASSET_BUCKET, hashBytes } from '@/server/letter-workflow';
import type { UserProfile } from '@/server/auth';

export type SigningAssetKind = 'SIGNATURE' | 'STAMP';

export function assertAssetOwner(user: UserProfile) {
  if (!user.isOfficialSigner || !['SM','DIR'].includes(user.position?.code || '')) {
    throw new Error('Akun tidak berwenang menggunakan aset pengesahan.');
  }
}

export async function saveSigningAsset(user: UserProfile, kind: SigningAssetKind, file: File) {
  assertAssetOwner(user);
  if (file.size>512*1024) throw new Error('Ukuran PNG maksimal 512 KB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  await validateSigningPng(bytes);
  const db=createAdminClient();
  const path=`${user.id}/master/${randomUUID()}.png`;
  const bucket=db.storage.from(ASSET_BUCKET);
  const upload=await bucket.upload(path,bytes,{contentType:'image/png',upsert:false});
  if(upload.error) throw new Error('Aset gagal diunggah.');
  const {error}=await db.rpc('save_official_signing_asset',{p_actor:user.id,p_kind:kind,p_path:path,p_hash:hashBytes(bytes)});
  // A lost RPC response can still mean the transaction committed. Retain the
  // immutable object so an uncertain response cannot break the active asset.
  if(error) throw new Error(error.message);
}

export async function readSigningAsset(user: UserProfile, kind: SigningAssetKind) {
  assertAssetOwner(user);
  const db=createAdminClient();
  const {data,error}=await db.from('official_signing_assets').select('storage_path,file_hash')
    .eq('owner_id',user.id).eq('kind',kind).maybeSingle();
  if(error) throw new Error('Aset pengesahan belum dapat dimuat.');
  if(!data) throw new Error(kind==='SIGNATURE'?'Unggah TTD di Master Pengesahan terlebih dahulu.':'Unggah stempel di Master Pengesahan terlebih dahulu.');
  const {data:file,error:downloadError}=await db.storage.from(ASSET_BUCKET).download(data.storage_path);
  if(downloadError||!file) throw new Error('Berkas aset tidak dapat diambil.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(hashBytes(bytes)!==data.file_hash) throw new Error('Aset pengesahan berubah atau rusak.');
  return bytes;
}
