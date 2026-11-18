-- PR-01: pengamanan notifikasi saja. Tidak mengubah surat/nomor/versi/audit lama.
-- Event baru tetap dibuat RPC alur sah bersama perubahan status dan audit.
-- Pengguna tidak diberi API/helper untuk mengirim event arbitrer.
begin;
revoke all privileges on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read, read_at) on table public.notifications to authenticated;

alter policy notifications_own on public.notifications
  using (recipient_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
  ));
alter policy notifications_mark_read on public.notifications
  using (recipient_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
  ))
  with check (recipient_id = (select auth.uid()) and is_read = true and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
  ));

create function app.guard_notification_read_update() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - 'is_read' - 'read_at') is distinct from
     (to_jsonb(old) - 'is_read' - 'read_at') then
    raise exception 'Isi pemberitahuan tidak dapat diubah.' using errcode = '42501';
  end if;
  if new.is_read is distinct from true then
    raise exception 'Pemberitahuan hanya dapat ditandai sudah dibaca.' using errcode = '42501';
  end if;
  -- Waktu pertama dibaca dari database; retry tidak memundurkan/mengganti bukti.
  new.read_at := case when old.is_read then coalesce(old.read_at, now()) else now() end;
  return new;
end $$;
revoke all on function app.guard_notification_read_update() from public, anon, authenticated;
create trigger notifications_read_update_guard before update on public.notifications
  for each row execute function app.guard_notification_read_update();
commit;
