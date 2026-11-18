-- PR-04 aditif. Tidak menulis ulang surat/nomor/versi/riwayat lama.
begin;
create table delivery_policy_managers(profile_id uuid primary key references profiles(id));
create table internal_delivery_settings(id boolean primary key default true check(id),cc_enabled boolean not null default false);
insert into internal_delivery_settings values(true,false);
create table dispatch_authorizations(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references profiles(id),unit_id uuid not null references organizational_units(id),
 starts_on date not null default (now() at time zone 'Asia/Jakarta')::date,ends_on date,is_active boolean not null default true,
 granted_by uuid not null references profiles(id),check(ends_on is null or ends_on>=starts_on));
create table internal_dispatches(
 id uuid primary key default gen_random_uuid(),letter_id uuid not null unique references letters(id),version_id uuid not null references letter_versions(id),
 file_hash text not null,storage_path text not null,file_format text not null check(file_format in ('PDF','DOCX')),
 official_number text not null,sender_id uuid not null references profiles(id),primary_recipient_id uuid not null references profiles(id),
 sent_at timestamptz not null default now(),idempotency_key text not null check(length(trim(idempotency_key)) between 1 and 200),
 unique(sender_id,idempotency_key));
create table dispatch_recipients(
 dispatch_id uuid not null references internal_dispatches(id),profile_id uuid not null references profiles(id),
 recipient_role text not null check(recipient_role in ('PRIMARY','CC')),read_at timestamptz,received_at timestamptz,received_by uuid references profiles(id),
 requires_response boolean not null default false check(recipient_role<>'CC' or not requires_response),
 primary key(dispatch_id,profile_id),check((received_at is null and received_by is null) or (recipient_role='PRIMARY' and received_at is not null and received_by is not null and received_by=profile_id)));
create unique index dispatch_one_primary on dispatch_recipients(dispatch_id) where recipient_role='PRIMARY';
create index dispatch_inbox on dispatch_recipients(profile_id,received_at,read_at,dispatch_id);
create index dispatch_outbox on internal_dispatches(sender_id,sent_at desc);
alter table notifications add column dispatch_id uuid references internal_dispatches(id);

create function app.is_dispatch_delegate(p_actor uuid,p_unit uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (app.active_assignment(p_actor)).id is not null and exists(select 1 from dispatch_authorizations a where a.profile_id=p_actor and a.unit_id=p_unit and a.is_active
 and a.starts_on<=(now() at time zone 'Asia/Jakarta')::date and (a.ends_on is null or a.ends_on>=(now() at time zone 'Asia/Jakarta')::date))
$$;
create function app.is_dispatch_recipient(p_actor uuid,p_letter uuid,p_version uuid default null) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor and is_active) and exists(select 1 from internal_dispatches d join dispatch_recipients r on r.dispatch_id=d.id
 where d.letter_id=p_letter and r.profile_id=p_actor and (p_version is null or d.version_id=p_version))
$$;
create function app.can_dispatch_letter(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (app.active_assignment(p_actor)).id is not null and exists(select 1 from letters l join letter_types t on t.id=l.letter_type_id where l.id=p_letter and t.category='INTERNAL'
 and (l.creator_id=p_actor or (l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(p_actor,l.creator_unit_id))))
$$;
create or replace function app.can_read_letter_for_pre_review(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from profiles where id=p_actor and is_active) and exists (
 select 1 from letters l where l.id=p_letter and (
 l.creator_id=p_actor or l.signer_id=p_actor

 or exists(select 1 from approval_steps a where a.letter_id=l.id and a.approver_id=p_actor and a.status<>'WAITING' and a.version_id=l.current_version_id and (a.required_roles is null or (a.cycle=l.approval_cycle and app.approval_roles_valid(p_actor,a.required_roles,l.creator_unit_id,l.letter_type_id))))
 or exists(select 1 from signature_requests s where s.letter_id=l.id and s.signer_id=p_actor)
 or exists(select 1 from cancellation_requests cr where cr.letter_id=l.id and (cr.requested_by=p_actor or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=p_actor)))
 or exists(select 1 from dispositions d where (d.letter_id=l.id and d.recipient_id=p_actor and (not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))) or (d.response_letter_id=l.id and d.giver_id=p_actor and d.submitted_at is not null and (l.recipient_user_id is distinct from p_actor or not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))))
 ))
$$;
create or replace function app.can_read_letter_for(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for_pre_review(p_actor,p_letter)
 or exists(select 1 from letters l join review_steps s on s.letter_id=l.id and s.version_id=l.current_version_id where l.id=p_letter and l.reviewer_id=p_actor and s.reviewer_id=p_actor and s.status in ('PENDING','PASSED') and l.review_status in ('WAITING','PASSED') and app.authorized_reviewer(p_actor,l.creator_unit_id,l.letter_type_id))
 or app.is_dispatch_recipient(p_actor,p_letter)
 or exists(select 1 from letters l where l.id=p_letter and l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(p_actor,l.creator_unit_id))
$$;
create or replace function app.can_read_review_version(p_letter uuid,p_version uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for_pre_review(auth.uid(),p_letter)
 or app.is_dispatch_recipient(auth.uid(),p_letter,p_version)
 or exists(select 1 from letters l where l.id=p_letter and l.current_version_id=p_version and (
  (l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(auth.uid(),l.creator_unit_id))
  or exists(select 1 from review_steps s where s.letter_id=l.id and s.version_id=p_version and s.reviewer_id=auth.uid() and l.reviewer_id=auth.uid() and s.status in ('PENDING','PASSED') and l.review_status in ('WAITING','PASSED') and app.authorized_reviewer(auth.uid(),l.creator_unit_id,l.letter_type_id))))
$$;

create function app.can_read_workflow_history(p_letter uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for_pre_review(auth.uid(),p_letter) or exists(select 1 from letters l join review_steps r on r.letter_id=l.id and r.version_id=l.current_version_id
 where l.id=p_letter and l.reviewer_id=auth.uid() and r.reviewer_id=auth.uid() and r.status in ('PENDING','PASSED') and l.review_status in ('WAITING','PASSED') and app.authorized_reviewer(auth.uid(),l.creator_unit_id,l.letter_type_id))
$$;
do $$ declare t text;begin
 foreach t in array array['approval_steps','signature_requests','billing_details','billing_items','letter_distributions','letter_attachments'] loop
  execute format('alter policy %I on public.%I using (app.can_read_workflow_history(letter_id))',t||'_read',t);
 end loop;
end $$;
revoke all on function app.can_read_workflow_history(uuid) from public,anon,authenticated;
grant execute on function app.can_read_workflow_history(uuid) to authenticated,service_role;
create function app.check_dispatch_ready(p_letter uuid) returns void
language plpgsql stable security invoker set search_path=public as $$
declare l letters;v letter_versions;source letter_versions;n integer;
begin
 select * into l from letters where id=p_letter;
 if l.status is distinct from 'NUMBERED' or l.finalized_at is null or l.official_number is null or not exists(select 1 from letter_types where id=l.letter_type_id and category='INTERNAL') then raise exception 'Surat internal harus bernomor dan final sebelum dikirim.';end if;
 select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
 if v.id is null or v.version_kind not in ('NUMBERED','SIGNED') or nullif(v.file_hash,'') is null or nullif(v.storage_path,'') is null then raise exception 'Versi dokumen final belum tersedia.';end if;
 if not exists(select 1 from number_issuances where letter_id=l.id and official_number=l.official_number and status='ISSUED') or not exists(select 1 from audit_logs where letter_id=l.id and action='FINALIZE' and version_id=v.id and actor_id=l.finalized_by) then raise exception 'Bukti penerbitan dan finalisasi belum lengkap.';end if;
 select * into source from letter_versions where id=l.approval_plan_version and letter_id=l.id;
 if source.id is null or l.approval_plan is null or l.approval_cycle is null then raise exception 'Bukti persetujuan versi pengajuan belum tersedia; data lama perlu ditinjau.';end if;
 n:=jsonb_array_length(l.approval_plan);
 if (select count(*) from approval_steps a where a.letter_id=l.id and a.cycle=l.approval_cycle and a.version_id=source.id and a.file_hash=source.file_hash and a.status='APPROVED')<>n
 or exists(select 1 from approval_steps where letter_id=l.id and cycle=l.approval_cycle and status in ('PENDING','WAITING')) then raise exception 'Seluruh persetujuan wajib belum selesai.';end if;
 if l.review_status='PASSED' then
  if not exists(select 1 from review_steps where letter_id=l.id and version_id=source.id and file_hash=source.file_hash and status='PASSED') then raise exception 'Bukti pemeriksaan versi pengajuan belum lengkap.';end if;
 elsif l.review_status is distinct from 'NOT_REQUIRED' then raise exception 'Pemeriksaan wajib belum selesai.';end if;
 if l.required_signature_count>0 then
  if l.signature_mode is distinct from 'IN_APP' then raise exception 'Pengiriman internal dengan TTD luar tanpa unggahan menunggu ketetapan perusahaan. Gunakan dokumen bertanda tangan yang tersimpan melalui jalur sah.';end if;
  if l.signature_status is distinct from 'UPLOADED' or v.version_kind<>'SIGNED' or (select count(*) from signature_requests where letter_id=l.id and status='UPLOADED')<>l.required_signature_count
  or not exists(select 1 from signature_requests where letter_id=l.id and signed_version_id=v.id and status='UPLOADED') then raise exception 'Pengesahan dokumen final belum lengkap.';end if;
 end if;
end $$;
create function dispatch_internal_letter(p_actor uuid,p_letter uuid,p_version uuid,p_hash text,p_key text,p_cc uuid[] default '{}') returns uuid
language plpgsql security invoker set search_path=public as $$
declare l letters;v letter_versions;d internal_dispatches;cc uuid[];x uuid;
begin
 select * into l from letters where id=p_letter for update;
 if not app.can_dispatch_letter(p_actor,p_letter) then raise exception 'Anda bukan pembuat atau pengirim yang diberi kewenangan untuk surat ini.';end if;
 if p_key is null or length(trim(p_key)) not between 1 and 200 then raise exception 'Kunci pengiriman tidak valid.';end if;
 if exists(select 1 from internal_dispatches where sender_id=p_actor and idempotency_key=p_key and letter_id<>p_letter) then raise exception 'Kunci pengiriman telah dipakai untuk surat lain.';end if;
 select coalesce(array_agg(distinct z order by z),'{}') into cc from unnest(coalesce(p_cc,'{}')) z;
 if array_position(coalesce(p_cc,'{}'),null) is not null or l.recipient_user_id=any(cc) then raise exception 'Penerima utama dan tembusan harus berbeda dan valid.';end if;
 select * into d from internal_dispatches where letter_id=l.id;
 if d.id is not null then
  if d.version_id is distinct from p_version or d.file_hash is distinct from p_hash or cc is distinct from array(select profile_id from dispatch_recipients where dispatch_id=d.id and recipient_role='CC' order by profile_id) then raise exception 'Pengiriman resmi sudah tercatat dengan snapshot/penerima berbeda.';end if;
  return d.id;
 end if;
 perform app.check_dispatch_ready(l.id);
 if cardinality(cc)>0 and not (select cc_enabled from internal_delivery_settings where id) then raise exception 'Tembusan belum diaktifkan melalui kebijakan perusahaan.';end if;
 if not exists(select 1 from profiles where id=l.recipient_user_id and is_active) or exists(select 1 from unnest(cc) z where not exists(select 1 from profiles where id=z and is_active)) then raise exception 'Pilih penerima internal yang aktif.';end if;
 select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
 if v.id is distinct from p_version or v.file_hash is distinct from p_hash then raise exception 'Snapshot dokumen final berubah; periksa ulang sebelum mengirim.';end if;
 insert into internal_dispatches(letter_id,version_id,file_hash,storage_path,file_format,official_number,sender_id,primary_recipient_id,idempotency_key)
 values(l.id,v.id,v.file_hash,v.storage_path,v.file_format,l.official_number,p_actor,l.recipient_user_id,p_key) returning * into d;
 insert into dispatch_recipients(dispatch_id,profile_id,recipient_role) values(d.id,l.recipient_user_id,'PRIMARY');
 insert into dispatch_recipients(dispatch_id,profile_id,recipient_role) select d.id,z,'CC' from unnest(cc) z;
 insert into notifications(recipient_id,letter_id,dispatch_id,event_type,title,is_read)
 select profile_id,l.id,d.id,'INTERNAL_SENT','Surat internal tersedia untuk Anda.',false from dispatch_recipients where dispatch_id=d.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
 values(p_actor,l.id,'INTERNAL_SENT','internal_dispatches',d.id::text,v.id,jsonb_build_object('file_hash',v.file_hash,'primary_recipient',l.recipient_user_id,'cc',cc,'idempotency_key',p_key));
 return d.id;
end $$;
create function record_internal_recipient_action(p_actor uuid,p_dispatch uuid,p_action text) returns timestamptz
language plpgsql security invoker set search_path=public as $$
declare d internal_dispatches;r dispatch_recipients;ts timestamptz;
begin
 if not exists(select 1 from profiles where id=p_actor and is_active) then raise exception 'Masuk dengan akun penerima aktif.';end if;
 select * into d from internal_dispatches where id=p_dispatch;
 select * into r from dispatch_recipients where dispatch_id=p_dispatch and profile_id=p_actor for update;
 if d.id is null or r.profile_id is null or p_action is null or p_action not in ('READ','RECEIVE') then raise exception 'Tindakan hanya untuk penerima sah pada pengiriman ini.';end if;
 if p_action='RECEIVE' and r.recipient_role<>'PRIMARY' then raise exception 'Penerimaan resmi hanya dicatat oleh penerima utama; tembusan tidak membuat kewajiban balasan.';end if;
 ts:=case p_action when 'READ' then r.read_at else r.received_at end;if ts is not null then return ts;end if;
 ts:=now();
 if p_action='READ' then update dispatch_recipients set read_at=ts where dispatch_id=d.id and profile_id=p_actor;
 else
  update dispatch_recipients set received_at=ts,received_by=p_actor where dispatch_id=d.id and profile_id=p_actor;
  insert into notifications(recipient_id,letter_id,dispatch_id,event_type,title,is_read)
  select distinct x,d.letter_id,d.id,'INTERNAL_RECEIVED','Penerima utama mengonfirmasi penerimaan surat.',false from unnest(array[d.sender_id,(select creator_id from letters where id=d.letter_id)])x;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,d.letter_id,'INTERNAL_'||p_action,'internal_dispatches',d.id::text,d.version_id);
 return ts;
end $$;
create function get_internal_delivery_context(p_actor uuid,p_letter uuid) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare l letters;d internal_dispatches;role text;full_access boolean;
begin
 if not app.can_read_letter_for(p_actor,p_letter) then raise exception 'Anda tidak berwenang melihat pengiriman surat ini.';end if;
 select * into l from letters where id=p_letter;select * into d from internal_dispatches where letter_id=l.id;
 select recipient_role into role from dispatch_recipients where dispatch_id=d.id and profile_id=p_actor;
 full_access:=app.can_read_letter_for_pre_review(p_actor,p_letter);
 return jsonb_build_object('canDispatch',app.can_dispatch_letter(p_actor,p_letter),'fullVersionAccess',full_access,'documentVersionId',case when full_access or role is null then l.current_version_id else d.version_id end,
 'dispatch',case when d.id is null then null else to_jsonb(d) end,'recipientRole',role,'ccEnabled',(select cc_enabled from internal_delivery_settings where id),
 'recipients',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from dispatch_recipients r where r.dispatch_id=d.id and (r.profile_id=p_actor or l.creator_id=p_actor or d.sender_id=p_actor)));
end $$;

create function configure_internal_delivery(p_actor uuid,p_delegate uuid,p_unit uuid,p_active boolean,p_end date,p_cc_enabled boolean,p_reason text) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if (app.active_assignment(p_actor)).id is null or not exists(select 1 from delivery_policy_managers where profile_id=p_actor) or nullif(trim(p_reason),'') is null then raise exception 'Pengaturan pengiriman hanya oleh pengelola yang ditetapkan perusahaan, dengan alasan.';end if;
 if p_delegate is not null then
  if (app.active_assignment(p_delegate)).id is null or p_unit is null or p_active is null then raise exception 'Delegasi dan lingkup unit wajib valid.';end if;
  if p_active then insert into dispatch_authorizations(profile_id,unit_id,ends_on,granted_by) values(p_delegate,p_unit,p_end,p_actor);
  else update dispatch_authorizations set is_active=false where profile_id=p_delegate and unit_id=p_unit;end if;
 end if;
 if p_cc_enabled is not null then update internal_delivery_settings set cc_enabled=p_cc_enabled where id;end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) values(p_actor,'DELIVERY_POLICY_SET','internal_delivery_settings','true',p_reason,jsonb_build_object('delegate',p_delegate,'unit',p_unit,'active',p_active,'ends_on',p_end,'cc_enabled',p_cc_enabled));
end $$;

create function app.freeze_dispatch_snapshot() returns trigger language plpgsql security invoker set search_path=public as $$
begin raise exception 'Snapshot pengiriman resmi tidak dapat diubah atau dihapus.' using errcode='42501';end $$;
create trigger internal_dispatches_immutable before update or delete on internal_dispatches for each row execute function app.freeze_dispatch_snapshot();
create function app.guard_dispatch_recipient() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'read_at'-'received_at'-'received_by') is distinct from (to_jsonb(old)-'read_at'-'received_at'-'received_by') then raise exception 'Identitas penerima resmi tidak dapat diubah.';end if;
 if (old.read_at is not null and new.read_at is distinct from old.read_at) or (old.received_at is not null and (new.received_at is distinct from old.received_at or new.received_by is distinct from old.received_by)) then raise exception 'Bukti baca/penerimaan pertama tidak dapat ditimpa.';end if;
 return new;
end $$;
create trigger dispatch_recipient_guard before update or delete on dispatch_recipients for each row execute function app.guard_dispatch_recipient();

alter table delivery_policy_managers enable row level security;
alter table internal_delivery_settings enable row level security;
alter table dispatch_authorizations enable row level security;
alter table internal_dispatches enable row level security;
alter table dispatch_recipients enable row level security;
create policy delivery_settings_read on internal_delivery_settings for select to authenticated using(true);
create policy dispatch_authorizations_own on dispatch_authorizations for select to authenticated using(profile_id=auth.uid());
create policy internal_dispatches_read on internal_dispatches for select to authenticated using(app.can_read_letter(letter_id));
create policy dispatch_recipients_read on dispatch_recipients for select to authenticated using(
 exists(select 1 from profiles where id=auth.uid() and is_active) and (profile_id=auth.uid() or exists(select 1 from internal_dispatches d join letters l on l.id=d.letter_id where d.id=dispatch_id and (d.sender_id=auth.uid() or l.creator_id=auth.uid()))));
revoke all on delivery_policy_managers,internal_delivery_settings,dispatch_authorizations,internal_dispatches,dispatch_recipients from public,anon,authenticated;
grant select on internal_delivery_settings,dispatch_authorizations,internal_dispatches,dispatch_recipients to authenticated;
grant all on delivery_policy_managers,internal_delivery_settings,dispatch_authorizations,internal_dispatches,dispatch_recipients to service_role;

-- Storage privat + proxy API saja; restrictive policy tidak memperlebar policy bucket lain.
do $$ begin
 if to_regclass('storage.objects') is not null then
  if exists(select 1 from storage.buckets where id in ('letter-documents','letter-attachments','signature-assets') and public) then raise exception 'Bucket dokumen harus privat sebelum migrasi pengiriman diterapkan.';end if;
  execute $p$create policy siadocs_private_proxy_only on storage.objects as restrictive for select to anon,authenticated using(bucket_id not in ('letter-documents','letter-attachments','signature-assets'))$p$;
 end if;
end $$;
revoke all on function app.is_dispatch_delegate(uuid,uuid),app.is_dispatch_recipient(uuid,uuid,uuid),app.can_dispatch_letter(uuid,uuid),app.check_dispatch_ready(uuid),app.freeze_dispatch_snapshot(),app.guard_dispatch_recipient() from public,anon,authenticated;
grant execute on function app.is_dispatch_delegate(uuid,uuid),app.is_dispatch_recipient(uuid,uuid,uuid),app.can_dispatch_letter(uuid,uuid),app.check_dispatch_ready(uuid) to service_role;
revoke all on function dispatch_internal_letter(uuid,uuid,uuid,text,text,uuid[]),record_internal_recipient_action(uuid,uuid,text),get_internal_delivery_context(uuid,uuid),configure_internal_delivery(uuid,uuid,uuid,boolean,date,boolean,text) from public,anon,authenticated;
grant execute on function dispatch_internal_letter(uuid,uuid,uuid,text,text,uuid[]),record_internal_recipient_action(uuid,uuid,text),get_internal_delivery_context(uuid,uuid),configure_internal_delivery(uuid,uuid,uuid,boolean,date,boolean,text) to service_role;
notify pgrst,'reload schema';
commit;
