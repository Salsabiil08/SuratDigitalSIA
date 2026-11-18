-- PR-03 aditif: tidak ada backfill surat, keputusan atau pengesahan lama.
begin;
create table approval_policy_managers(profile_id uuid primary key references profiles(id));
create table approver_authorizations(
 id uuid primary key default gen_random_uuid(),approver_id uuid not null references profiles(id),
 unit_id uuid references organizational_units(id),letter_type_id uuid references letter_types(id),
 starts_on date not null default (now() at time zone 'Asia/Jakarta')::date,ends_on date,is_active boolean not null default true,
 granted_by uuid not null references profiles(id),created_at timestamptz not null default now(),check(ends_on is null or ends_on>=starts_on));
alter table letters add column mandatory_approver_ids uuid[];
alter table letters add column additional_approver_ids uuid[];
alter table letters add column approval_plan jsonb;
alter table letters add column approval_plan_version uuid references letter_versions(id);
alter table letters add column approval_cycle integer;
alter table letters add column resubmission_required_version uuid references letter_versions(id);
alter table approval_steps add column required_roles text[];
alter table approval_steps add column file_hash text;
alter table approval_steps add column decision_origin text check(decision_origin in ('EXPLICIT','CREATOR_SUBMISSION'));
alter table approval_steps add column creator_confirmed_at timestamptz;
-- Index baru hanya siklus baru, tidak memaksa rekonsiliasi row lama.
create unique index approval_steps_new_actor_cycle on approval_steps(letter_id,cycle,approver_id) where required_roles is not null;

create function app.authorized_approver(p_actor uuid,p_unit uuid,p_type uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (app.active_assignment(p_actor)).id is not null and exists(select 1 from approver_authorizations a where a.approver_id=p_actor and a.is_active
 and (a.unit_id is null or a.unit_id=p_unit) and (a.letter_type_id is null or a.letter_type_id=p_type)
 and a.starts_on<=(now() at time zone 'Asia/Jakarta')::date and (a.ends_on is null or a.ends_on>=(now() at time zone 'Asia/Jakarta')::date))
$$;
create function app.approval_roles_valid(p_actor uuid,p_roles text[],p_unit uuid,p_type uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare a user_assignments; code text; r text;
begin
 a:=app.active_assignment(p_actor);if a.id is null or p_roles is null or cardinality(p_roles)=0 then return false;end if;
 select positions.code into code from positions where id=a.position_id;
 foreach r in array p_roles loop
  if r is null or r not in ('FORMAL_AUTHORITY','BILLING_FINANCE','BILLING_DIRECTOR','ADDITIONAL') then return false;end if;
  if r='FORMAL_AUTHORITY' and not app.valid_signer(p_actor) then return false;
  elsif r='BILLING_FINANCE' and (code<>'SM' or not app.valid_signer(p_actor) or (a.unit_id<>p_unit and not app.authorized_approver(p_actor,p_unit,p_type))) then return false;
  elsif r='BILLING_DIRECTOR' and (code<>'DIR' or not app.valid_signer(p_actor)) then return false;
  elsif r='ADDITIONAL' and cardinality(p_roles)=1 and not app.authorized_approver(p_actor,p_unit,p_type) then return false;
  end if;
 end loop;
 return true;
end $$;
create function app.build_approval_plan(p_letter uuid) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare l letters; t letter_types; ids uuid[]; extra uuid[]; role text; i integer; actor uuid; entries jsonb:='[]'; result jsonb;
begin
 select * into l from letters where id=p_letter;
 select * into t from letter_types where id=l.letter_type_id;
 ids:=coalesce(l.mandatory_approver_ids,l.signer_ids,'{}');extra:=coalesce(l.additional_approver_ids,'{}');
 if cardinality(ids)<>(case when t.category='BILLING' then 2 when t.category='EXTERNAL' or l.required_signature_count>0 then 1 else 0 end) then raise exception 'Lengkapi pejabat penyetuju wajib sesuai jenis surat.';end if;
 if t.category='BILLING' and ids[1]=ids[2] then raise exception 'Kewenangan SM Finance dan Direktur harus dipenuhi oleh pejabat yang berbeda.';end if;
 for i in 1..cardinality(ids) loop
  actor:=ids[i];role:=case when t.category='BILLING' then case when i=1 then 'BILLING_FINANCE' else 'BILLING_DIRECTOR' end else 'FORMAL_AUTHORITY' end;
  if actor is null or not app.approval_roles_valid(actor,array[role],l.creator_unit_id,l.letter_type_id) then raise exception 'Pejabat penyetuju wajib tidak memiliki kewenangan yang masih berlaku.';end if;
  entries:=entries||jsonb_build_array(jsonb_build_object('actor',actor,'role',role,'ord',i));
 end loop;
 foreach actor in array extra loop
  if actor is null or (not actor=any(ids) and not app.authorized_approver(actor,l.creator_unit_id,l.letter_type_id)) then raise exception 'Penyetuju tambahan belum memiliki penugasan jenis dan unit yang sah.';end if;
  entries:=entries||jsonb_build_array(jsonb_build_object('actor',actor,'role','ADDITIONAL','ord',cardinality(ids)+array_position(extra,actor)));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('actor',x.actor,'roles',x.roles,'ord',x.ord) order by x.ord,x.actor),'[]') into result
 from(select e->>'actor' actor,jsonb_agg(distinct e->>'role' order by e->>'role') roles,min((e->>'ord')::integer) ord from jsonb_array_elements(entries) e group by e->>'actor') x;
 return result;
end $$;
create function app.approvals_complete(p_letter uuid) returns boolean
language plpgsql stable security invoker set search_path=public as $$
declare l letters; plan jsonb; v letter_versions;
begin
 select * into l from letters where id=p_letter;select * into v from letter_versions where id=l.current_version_id;
 if l.approval_plan_version is distinct from l.current_version_id or l.approval_plan is null then return false;end if;
 plan:=app.build_approval_plan(l.id);
 if plan is distinct from l.approval_plan then return false;end if;
 return (select count(*) from approval_steps s where s.letter_id=l.id and s.cycle=l.approval_cycle and s.version_id=v.id and s.file_hash=v.file_hash and s.status='APPROVED')=jsonb_array_length(plan)
 and not exists(select 1 from approval_steps s where s.letter_id=l.id and s.cycle=l.approval_cycle and s.status in ('PENDING','WAITING'));
end $$;

alter function save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_pre_approval;
create function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare v_id uuid; mandatory uuid[]; extra uuid[];
begin
 v_id:=save_letter_draft_pre_approval(p_actor,p_data,p_document);
 if p_data ? 'mandatoryApproverIds' then select coalesce(array_agg(x::uuid),'{}') into mandatory from jsonb_array_elements_text(p_data->'mandatoryApproverIds') x;
 else select signer_ids into mandatory from letters where id=v_id;end if;
 select coalesce(array_agg(x::uuid),'{}') into extra from jsonb_array_elements_text(coalesce(p_data->'additionalApproverIds','[]')) x;
 update letters set mandatory_approver_ids=mandatory,additional_approver_ids=extra,approval_plan=null,approval_plan_version=null,approval_cycle=null,resubmission_required_version=null where id=v_id;
 perform app.build_approval_plan(v_id);
 return v_id;
end $$;

create function app.advance_approvals(p_letter uuid) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; s approval_steps;
begin
 select * into l from letters where id=p_letter for update;
 loop
  select * into s from approval_steps where letter_id=l.id and cycle=l.approval_cycle and status in ('PENDING','WAITING') order by step_order limit 1 for update;
  if s.id is null then update letters set status='READY_TO_ISSUE' where id=l.id;return 'READY_TO_ISSUE';end if;
  if s.decision_origin='CREATOR_SUBMISSION' and s.approver_id=l.creator_id and s.creator_confirmed_at is not null then
   update approval_steps set status='APPROVED',decided_at=now() where id=s.id;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
    values(l.creator_id,l.id,'CREATOR_APPROVAL_EFFECTIVE','approval_steps',s.id::text,s.version_id,jsonb_build_object('confirmed_at',s.creator_confirmed_at,'required_roles',s.required_roles));
  else
   update approval_steps set status='PENDING' where id=s.id;
   update letters set status='IN_REVIEW' where id=l.id;
   insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(s.approver_id,l.id,'APPROVAL_REQUEST','Surat menunggu persetujuan Anda.',false);
   return 'IN_REVIEW';
  end if;
 end loop;
end $$;
create function app.submit_approval_plan(p_actor uuid,p_letter uuid,p_confirm_self boolean) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; v letter_versions; plan jsonb; e jsonb; roles text[]; seq integer; i integer:=0; dest text;
begin
 select * into l from letters where id=p_letter for update;
 if l.resubmission_required_version=l.current_version_id then raise exception 'Simpan koreksi sebagai versi baru sebelum mengajukan ulang.';end if;
 if exists(select 1 from letter_types where id=l.letter_type_id and required_attachment) and not exists(select 1 from letter_attachments where letter_id=l.id) then raise exception 'Lampiran bukti wajib sebelum pengajuan.';end if;
 plan:=app.build_approval_plan(l.id);
 if exists(select 1 from jsonb_array_elements(plan) x where (x->>'actor')::uuid=p_actor) and p_confirm_self is distinct from true then raise exception 'Konfirmasikan persetujuan Anda atas versi ini saat mengajukan sesuai kewenangan.';end if;
 select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
 if v.id is null or nullif(v.file_hash,'') is null then raise exception 'Versi dokumen belum tersedia.';end if;
 select coalesce(max(cycle),0)+1 into seq from approval_steps where letter_id=l.id;
 update approval_steps set status='SUPERSEDED' where letter_id=l.id and status in ('PENDING','WAITING');
 for e in select * from jsonb_array_elements(plan) loop
  i:=i+1;select array_agg(x) into roles from jsonb_array_elements_text(e->'roles') x;
  insert into approval_steps(letter_id,cycle,step_order,approver_id,step_source,status,version_id,file_hash,required_roles,decision_origin,creator_confirmed_at)
   values(l.id,seq,i,(e->>'actor')::uuid,case when 'BILLING_FINANCE'=any(roles) then 'BILLING_SUBMITTER' when 'BILLING_DIRECTOR'=any(roles) then 'BILLING_APPROVER' when 'FORMAL_AUTHORITY'=any(roles) then 'SIGNER_CONFIRMATION' else 'CREATOR_SELECTED' end,'WAITING',v.id,v.file_hash,roles,
    case when (e->>'actor')::uuid=p_actor then 'CREATOR_SUBMISSION' else 'EXPLICIT' end,case when (e->>'actor')::uuid=p_actor then now() else null end);
 end loop;
 update letters set approval_plan=plan,approval_plan_version=v.id,approval_cycle=seq where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata) values(p_actor,l.id,'SUBMIT','letters',l.id::text,v.id,jsonb_build_object('approval_plan',plan,'creator_confirmed',p_confirm_self));
 dest:=app.advance_approvals(l.id);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,'SUBMIT','Pengajuan surat telah diproses.',false);
 return dest;
end $$;

alter function review_letter(uuid,uuid,text,integer,text) rename to review_letter_pre_approval;
create function submit_letter_for_approval(p_actor uuid,p_letter uuid,p_revision integer,p_confirm_self boolean default false) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; p review_policies; v letter_versions; s review_steps; seq integer;
begin
 select * into l from letters where id=p_letter for update;
 if l.resubmission_required_version=l.current_version_id then raise exception 'Simpan koreksi sebagai versi baru sebelum mengajukan ulang.';end if;
 if true then
   if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null
   or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null
   or l.revision is distinct from p_revision or l.previewed_revision is distinct from l.revision then raise exception 'Simpan dan pratinjau versi terkini sebelum mengajukan.'; end if;
   p:=app.review_policy(l.category_id,l.letter_type_id);
   if p.id is null then raise exception 'Pilih kategori dan aturan pemeriksaan sebelum pengajuan.'; end if;
   if p.requires_review or l.reviewer_id is not null then
     if l.reviewer_id is null or l.reviewer_id=p_actor or not app.authorized_reviewer(l.reviewer_id,l.creator_unit_id,l.letter_type_id) then raise exception 'Pemeriksa berwenang wajib dipilih sebelum pengajuan.'; end if;
     if not app.review_passed(l.id) then
       select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
       if v.id is null or nullif(v.file_hash,'') is null then raise exception 'Versi dokumen belum tersedia.'; end if;
       if exists(select 1 from review_steps where letter_id=l.id and version_id=v.id and status='REVISION_REQUESTED') then raise exception 'Simpan revisi sebagai versi baru sebelum mengajukan kembali.'; end if;
       select * into s from review_steps where letter_id=l.id and version_id=v.id and reviewer_id=l.reviewer_id
         and policy_id=p.id and policy_revision=p.revision and status='PENDING';
       if s.id is not null then return 'WAITING_REVIEW'; end if;
       select coalesce(max(cycle),0)+1 into seq from review_steps where letter_id=l.id;
       insert into review_steps(letter_id,version_id,file_hash,reviewer_id,cycle,policy_id,policy_revision)
       values(l.id,v.id,v.file_hash,l.reviewer_id,seq,p.id,p.revision);
       update letters set review_status='WAITING',revision=revision+1,previewed_revision=revision+1 where id=l.id;
       insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,l.id,'REVIEW_REQUESTED','letters',l.id::text,v.id);
       insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.reviewer_id,l.id,'REVIEW_REQUESTED','Surat menunggu pemeriksaan Anda.',false);
       return 'WAITING_REVIEW';
     end if;
   end if;
 end if;
 return app.submit_approval_plan(p_actor,p_letter,p_confirm_self);
end $$;

create function review_letter(p_actor uuid,p_letter uuid,p_action text,p_revision integer,p_note text default null) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; s approval_steps; dest text;
begin
 if p_action='SUBMIT' then return submit_letter_for_approval(p_actor,p_letter,p_revision,false);end if;
 if p_action='PREVIEW' then return review_letter_pre_approval(p_actor,p_letter,p_action,p_revision,p_note);end if;
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.status<>'IN_REVIEW' or l.finalized_at is not null or l.revision is distinct from p_revision then raise exception 'Surat tidak dalam persetujuan atau versinya telah berubah.';end if;
 if app.build_approval_plan(l.id) is distinct from l.approval_plan or l.approval_plan_version is distinct from l.current_version_id then raise exception 'Versi atau kewenangan persetujuan berubah; ajukan ulang melalui pembuat.';end if;
 select * into s from approval_steps where letter_id=l.id and cycle=l.approval_cycle and approver_id=p_actor and status='PENDING' for update;
 if s.id is null or s.version_id is distinct from l.current_version_id or s.file_hash is distinct from (select file_hash from letter_versions where id=l.current_version_id)
 or not app.approval_roles_valid(p_actor,s.required_roles,l.creator_unit_id,l.letter_type_id) then raise exception 'Anda bukan penyetuju aktif untuk versi ini.';end if;
 if p_action not in ('APPROVE','REJECT','REQUEST_REVISION') or p_action is null then raise exception 'Tindakan persetujuan tidak valid.';end if;
 if p_action<>'APPROVE' and nullif(trim(p_note),'') is null then raise exception 'Alasan wajib diisi.';end if;
 update approval_steps set status=case p_action when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end,decision_origin='EXPLICIT',decision_note=nullif(trim(p_note),''),decided_at=now() where id=s.id;
 if p_action='APPROVE' then dest:=app.advance_approvals(l.id);
 else
  dest:=case p_action when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end;
  update approval_steps set status='SUPERSEDED' where letter_id=l.id and cycle=l.approval_cycle and status in ('PENDING','WAITING');
  update letters set status=dest,previewed_revision=null,status_reason=p_note where id=l.id;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,reason) values(p_actor,l.id,p_action,'approval_steps',s.id::text,s.version_id,p_note);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,p_action,'Keputusan persetujuan telah dicatat.',false);
 return dest;
end $$;
create function restart_letter_approval(p_actor uuid,p_letter uuid,p_revision integer,p_reason text) returns void
language plpgsql security invoker set search_path=public as $$
declare l letters;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null or l.official_number is not null or l.finalized_at is not null
 or l.status not in ('DRAFT','IN_REVIEW','READY_TO_ISSUE','REVISION_REQUESTED') or l.revision is distinct from p_revision or nullif(trim(p_reason),'') is null then raise exception 'Koreksi pengajuan hanya oleh pembuat aktif sebelum nomor terbit, dengan alasan dan versi terkini.';end if;
 update approval_steps set status='SUPERSEDED' where letter_id=l.id and status in ('WAITING','PENDING');
 update letters set status='REVISION_REQUESTED',review_status='NOT_STARTED',previewed_revision=null,revision=revision+1,
  approval_plan=null,approval_plan_version=null,approval_cycle=null,resubmission_required_version=current_version_id where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,reason) values(p_actor,l.id,'RESTART_APPROVAL','letters',l.id::text,l.current_version_id,p_reason);
end $$;
create or replace function issue_letter_number_pre_review(p_letter_id uuid,p_actor uuid,p_idempotency_key text)
returns number_issuances language plpgsql security definer set search_path=public as $$
declare l letters; iss number_issuances; i integer; series number_series; t letter_types; pos uuid; floor_value integer; yr integer;
begin
 select * into l from letters where id=p_letter_id for update;
 if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null then raise exception 'Hanya pembuat aktif dapat menerbitkan nomor.'; end if;
 if l.official_number is not null then select * into iss from number_issuances where letter_id=l.id; if iss.id is null or iss.status='CANCELLED' then raise exception 'Penerbitan lama perlu ditinjau pengelola.'; end if; return iss; end if;
 if l.current_version_id is null or l.status<>'READY_TO_ISSUE' or cardinality(l.signer_ids)<>l.required_signature_count then raise exception 'Surat belum siap diterbitkan.'; end if;
 if not app.approvals_complete(l.id)
 or exists(select 1 from unnest(l.signer_ids) x where not app.valid_signer(x)) then raise exception 'Persetujuan/kewenangan wajib belum lengkap.'; end if;
 select * into t from letter_types where id=l.letter_type_id;
 pos:=(app.active_assignment(l.signer_id)).position_id;
 select * into series from number_series where letter_type_id=t.id and status='ACTIVE' and
 ((t.series_basis='SIGNER_POSITION' and position_id=pos) or (t.series_basis='CREATOR_UNIT' and unit_id=l.creator_unit_id)) limit 1;
 if series.id is null then raise exception 'Tidak ada seri nomor aktif sesuai unit/jabatan.'; end if;
 yr:=extract(year from now() at time zone 'Asia/Jakarta');
 -- Nomor lama dibuat tanpa issuance. Counter tidak boleh menggunakan ulang nomor tersebut.
 select coalesce(max((regexp_match(x.official_number,'^([0-9]{3,})[0-9]{2}[-/]'))[1]::integer),0) into floor_value
 from letters x where x.letter_type_id=t.id and right(x.official_number,4)=yr::text and
 ((t.series_basis='CREATOR_UNIT' and x.creator_unit_id=l.creator_unit_id) or
 (t.series_basis='SIGNER_POSITION' and (app.active_assignment(x.signer_id)).position_id=pos));
 insert into number_counters(series_id,year,last_value) values(series.id,yr,floor_value)
 on conflict(series_id,year) do update set last_value=greatest(number_counters.last_value,excluded.last_value);
 iss:=issue_letter_number_core(p_letter_id,p_actor,p_idempotency_key);
 if l.signature_mode='IN_APP' then
   for i in 1..cardinality(l.signer_ids) loop
     insert into signature_requests(letter_id,numbered_version_id,signer_id,sign_order,signer_role,status)
     values(l.id,l.current_version_id,l.signer_ids[i],i,(select p.name from app.active_assignment(l.signer_ids[i]) a join positions p on p.id=a.position_id),case when i=1 then 'PENDING' else 'WAITING' end);
   end loop;
 end if;
 return iss;
end $$;

create or replace function app.can_read_letter_for_pre_review(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from profiles where id=p_actor and is_active) and exists (
 select 1 from letters l where l.id=p_letter and (
 l.creator_id=p_actor or l.signer_id=p_actor
 or (l.recipient_user_id=p_actor and l.status in ('NUMBERED','CANCELLED'))
 or exists(select 1 from approval_steps a where a.letter_id=l.id and a.approver_id=p_actor and a.status<>'WAITING' and a.version_id=l.current_version_id and (a.required_roles is null or (a.cycle=l.approval_cycle and app.approval_roles_valid(p_actor,a.required_roles,l.creator_unit_id,l.letter_type_id))))
 or exists(select 1 from signature_requests s where s.letter_id=l.id and s.signer_id=p_actor)
 or exists(select 1 from cancellation_requests cr where cr.letter_id=l.id and (cr.requested_by=p_actor or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=p_actor)))
 or exists(select 1 from dispositions d where (d.letter_id=l.id and d.recipient_id=p_actor) or (d.response_letter_id=l.id and d.giver_id=p_actor and d.submitted_at is not null))
 ))
$$;
alter table approval_policy_managers enable row level security;
alter table approver_authorizations enable row level security;
create policy approver_authorizations_own on approver_authorizations for select to authenticated using(approver_id=auth.uid());
revoke all on approval_policy_managers,approver_authorizations from public,anon,authenticated;
grant select on approver_authorizations to authenticated;
grant all on approval_policy_managers,approver_authorizations to service_role;
create function authorize_letter_approver(p_actor uuid,p_approver uuid,p_unit uuid,p_type uuid,p_active boolean,p_end date,p_reason text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if (app.active_assignment(p_actor)).id is null or not exists(select 1 from approval_policy_managers where profile_id=p_actor) then raise exception 'Anda bukan pengelola kewenangan persetujuan perusahaan.';end if;
 if (app.active_assignment(p_approver)).id is null or p_active is null or nullif(trim(p_reason),'') is null then raise exception 'Penyetuju aktif dan alasan penugasan wajib diisi.';end if;
 if p_active then insert into approver_authorizations(approver_id,unit_id,letter_type_id,ends_on,granted_by) values(p_approver,p_unit,p_type,p_end,p_actor) returning id into v_id;
 else update approver_authorizations set is_active=false where approver_id=p_approver and unit_id is not distinct from p_unit and letter_type_id is not distinct from p_type;v_id:=p_approver;end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) values(p_actor,'APPROVER_AUTHORIZATION_SET','approver_authorizations',v_id::text,p_reason,jsonb_build_object('approver',p_approver,'unit',p_unit,'type',p_type,'is_active',p_active,'ends_on',p_end));
 return v_id;
end $$;
create function app.guard_approval_fields() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('authenticated','anon') and (new.mandatory_approver_ids is distinct from old.mandatory_approver_ids or new.additional_approver_ids is distinct from old.additional_approver_ids
 or new.approval_plan is distinct from old.approval_plan or new.approval_plan_version is distinct from old.approval_plan_version or new.approval_cycle is distinct from old.approval_cycle or new.resubmission_required_version is distinct from old.resubmission_required_version) then raise exception 'Persetujuan hanya melalui alur resmi.' using errcode='42501';end if;
 return new;
end $$;
create trigger letters_approval_fields_guard before update on letters for each row execute function app.guard_approval_fields();
revoke all on function app.guard_approval_fields() from public,anon,authenticated;
revoke all on function app.authorized_approver(uuid,uuid,uuid),app.approval_roles_valid(uuid,text[],uuid,uuid),app.build_approval_plan(uuid),app.approvals_complete(uuid),app.advance_approvals(uuid),app.submit_approval_plan(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function app.authorized_approver(uuid,uuid,uuid),app.approval_roles_valid(uuid,text[],uuid,uuid),app.build_approval_plan(uuid),app.approvals_complete(uuid),app.advance_approvals(uuid),app.submit_approval_plan(uuid,uuid,boolean) to service_role;
revoke all on function save_letter_draft(uuid,jsonb,jsonb),review_letter(uuid,uuid,text,integer,text),submit_letter_for_approval(uuid,uuid,integer,boolean),restart_letter_approval(uuid,uuid,integer,text),authorize_letter_approver(uuid,uuid,uuid,uuid,boolean,date,text) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb),review_letter(uuid,uuid,text,integer,text),submit_letter_for_approval(uuid,uuid,integer,boolean),restart_letter_approval(uuid,uuid,integer,text),authorize_letter_approver(uuid,uuid,uuid,uuid,boolean,date,text) to service_role;
notify pgrst,'reload schema';
commit;
