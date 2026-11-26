begin;
create table public.official_signing_assets (
 owner_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('SIGNATURE','STAMP')),
 storage_path text not null unique,
 file_hash text not null check(file_hash ~ '^[0-9a-f]{64}$'),
 updated_at timestamptz not null default now(),
 primary key(owner_id,kind),
 check(split_part(storage_path,'/',1)=owner_id::text)
);
alter table public.official_signing_assets enable row level security;
revoke all on public.official_signing_assets from public,anon,authenticated;
grant all on public.official_signing_assets to service_role;

create function public.save_official_signing_asset(
 p_actor uuid,p_kind text,p_path text,p_hash text
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not app.valid_signer(p_actor) then raise exception 'Akun tidak berwenang mengelola aset pengesahan.';end if;
 if not exists(select 1 from storage.objects where bucket_id='signature-assets' and name=p_path) then
   raise exception 'Berkas aset belum tersimpan.';
 end if;
 insert into official_signing_assets(owner_id,kind,storage_path,file_hash)
 values(p_actor,p_kind,p_path,p_hash)
 on conflict(owner_id,kind) do update set storage_path=excluded.storage_path,file_hash=excluded.file_hash,updated_at=now();
 insert into audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(p_actor,'SIGNING_ASSET_SAVED','official_signing_assets',p_actor::text,jsonb_build_object('kind',p_kind,'hash',p_hash));
end $$;
revoke all on function public.save_official_signing_asset(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_official_signing_asset(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
