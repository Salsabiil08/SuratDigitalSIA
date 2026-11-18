-- Hanya database test, meniru schema minimum Storage untuk menguji RLS.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select on storage.objects to anon,authenticated;
-- Policy permisif hipotetis tidak boleh membuka bucket SIADocs.
create policy test_broad_storage_read on storage.objects for select to anon,authenticated using(true);
