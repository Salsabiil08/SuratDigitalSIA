-- Additive registration only. Existing profiles, assignments, letters and numbering are unchanged.
create table public.account_registrations (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null unique references public.profiles(id) on delete cascade,
 requested_unit_id uuid references public.organizational_units(id),
 requested_position_id uuid references public.positions(id),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
 created_at timestamptz not null default now(),
 decided_by uuid references public.profiles(id),
 decided_at timestamptz,
 approved_unit_id uuid references public.organizational_units(id),
 approved_position_id uuid references public.positions(id),
 decision_note text,
 check((status='PENDING' and decided_by is null and decided_at is null) or (status<>'PENDING' and decided_by is not null and decided_at is not null))
);
alter table public.account_registrations enable row level security;
revoke all on public.account_registrations from public,anon,authenticated;
grant select on public.account_registrations to authenticated;
create policy account_registrations_admin_read on public.account_registrations for select to authenticated using(app.is_super_admin());
grant all on public.account_registrations to service_role;

create function app.handle_account_registration() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare unit_id uuid;position_id uuid;unit_text text;position_text text;
begin
 -- Only the explicit application signup flow bootstraps a pending profile.
 -- Metadata supplies a REQUEST, never a role, activation, or signer mandate.
 if coalesce(new.raw_user_meta_data->>'siadocs_registration','')<>'true' then return new;end if;
 unit_text:=new.raw_user_meta_data->>'requested_unit_id';
 position_text:=new.raw_user_meta_data->>'requested_position_id';
 if unit_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select id into unit_id from organizational_units where id=unit_text::uuid and is_active;
 end if;
 if position_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select id into position_id from positions where id=position_text::uuid and is_active;
 end if;
 insert into profiles(id,full_name,email,system_role,is_active)
 values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'Pengguna Baru'),120),new.email,'USER',false);
 insert into account_registrations(profile_id,requested_unit_id,requested_position_id) values(new.id,unit_id,position_id);
 insert into audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(new.id,'ACCOUNT_REGISTRATION_REQUESTED','account_registrations',new.id::text,jsonb_build_object('requested_unit',unit_id,'requested_position',position_id));
 return new;
end $$;
revoke all on function app.handle_account_registration() from public,anon,authenticated;
create trigger siadocs_pending_account after insert on auth.users for each row execute function app.handle_account_registration();

-- Pending Auth sessions must not inherit the pre-existing organization directory read.
create function app.registration_directory_reader() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select app.is_super_admin() or (app.active_assignment(auth.uid())).id is not null
$$;
revoke all on function app.registration_directory_reader() from public,anon;
grant execute on function app.registration_directory_reader() to authenticated,service_role;
alter policy profiles_read on public.profiles using(id=auth.uid() or app.registration_directory_reader());
alter policy user_assignments_read on public.user_assignments using(profile_id=auth.uid() or app.registration_directory_reader());

create function public.decide_account_registration(p_actor uuid,p_request uuid,p_action text,p_unit uuid,p_position uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r account_registrations;assignment_id uuid;
begin
 if not exists(select 1 from profiles where id=p_actor and is_active and system_role='SUPER_ADMIN') then raise exception 'Hanya Super Admin aktif dapat memeriksa pendaftaran.';end if;
 if p_action is null or p_action not in ('APPROVE','REJECT') then raise exception 'Keputusan pendaftaran tidak valid.';end if;
 if p_note is null or char_length(btrim(p_note))<3 or char_length(p_note)>1000 then raise exception 'Isi catatan keputusan 3 sampai 1000 karakter.';end if;
 select * into r from account_registrations where id=p_request for update;
 if r.id is null then raise exception 'Pendaftaran tidak ditemukan.';end if;
 if r.status<>'PENDING' then
  if (r.status='APPROVED' and p_action='APPROVE' and r.approved_unit_id=p_unit and r.approved_position_id=p_position)
   or (r.status='REJECTED' and p_action='REJECT') then return jsonb_build_object('status',r.status,'profileId',r.profile_id);end if;
  raise exception 'Pendaftaran sudah diputuskan. Muat ulang daftar.';
 end if;
 perform 1 from profiles where id=r.profile_id for update;
 if not exists(select 1 from profiles where id=r.profile_id and system_role='USER' and not is_active) then raise exception 'Profil ini tidak dapat diaktifkan melalui pendaftaran baru.';end if;
 if p_action='APPROVE' then
  if not exists(select 1 from organizational_units where id=p_unit and is_active) or not exists(select 1 from positions where id=p_position and is_active) then raise exception 'Pilih unit dan jabatan aktif yang sah.';end if;
  if exists(select 1 from user_assignments where profile_id=r.profile_id and is_active) then raise exception 'Profil sudah memiliki penugasan aktif. Periksa data pengguna.';end if;
  -- Many users may occupy the same unit/position. Never replace the existing employee.
  insert into user_assignments(profile_id,unit_id,position_id,is_official_signer,start_date,is_active)
  values(r.profile_id,p_unit,p_position,false,(now() at time zone 'Asia/Jakarta')::date,true) returning id into assignment_id;
  update profiles set is_active=true where id=r.profile_id;
 end if;
 update account_registrations set status=case p_action when 'APPROVE' then 'APPROVED' else 'REJECTED' end,
  decided_by=p_actor,decided_at=now(),approved_unit_id=case when p_action='APPROVE' then p_unit end,
  approved_position_id=case when p_action='APPROVE' then p_position end,decision_note=btrim(p_note) where id=r.id;
 insert into audit_logs(actor_id,action,entity_type,entity_id,reason,metadata)
 values(p_actor,case p_action when 'APPROVE' then 'ACCOUNT_REGISTRATION_APPROVED' else 'ACCOUNT_REGISTRATION_REJECTED' end,
  'account_registrations',r.id::text,btrim(p_note),jsonb_build_object('profile',r.profile_id,'unit',case when p_action='APPROVE' then p_unit end,'position',case when p_action='APPROVE' then p_position end,'assignment',assignment_id));
 return jsonb_build_object('status',case p_action when 'APPROVE' then 'APPROVED' else 'REJECTED' end,'profileId',r.profile_id);
end $$;
revoke all on function public.decide_account_registration(uuid,uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.decide_account_registration(uuid,uuid,text,uuid,uuid,text) to service_role;
