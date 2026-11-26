-- Unified content examination and approval. Historical review evidence is retained.
begin;
alter table letters add column unified_approval boolean not null default false;
alter table letters alter column unified_approval set default true;
alter table letters add column content_approval_required boolean not null default false;
alter table letters add column approval_required_from_review boolean not null default false;
alter table approval_steps add column comments jsonb not null default '[]';
create function app.content_approver(p_creator uuid,p_approver uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select p_creator<>p_approver and exists(select 1 from positions c join positions a on true where c.id=(app.active_assignment(p_creator)).position_id and a.id=(app.active_assignment(p_approver)).position_id and c.code in('STF','GM','SM') and a.code in('GM','SM','DIR') and (case a.code when 'GM' then 2 when 'SM' then 3 when 'DIR' then 4 end)>(case c.code when 'STF' then 1 when 'GM' then 2 when 'SM' then 3 end))
 and ((select code from positions where id=(app.active_assignment(p_approver)).position_id)<>'GM'
 or (app.active_assignment(p_creator)).unit_id=(app.active_assignment(p_approver)).unit_id)
$$;
revoke all on function app.content_approver(uuid,uuid) from public,anon,authenticated;
grant execute on function app.content_approver(uuid,uuid) to service_role;

-- Retain the old planner only for already-issued documents, preserving their valid snapshots.
alter function app.build_approval_plan(uuid) rename to build_approval_plan_pre_unified;
create function app.build_approval_plan(p_letter uuid) returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare l letters;t letter_types;ids uuid[];extra uuid[];actor uuid;role text;i integer;entries jsonb:='[]';result jsonb;creator_code text;peer boolean;
begin
 select * into l from letters where id=p_letter;
 if not l.unified_approval then return app.build_approval_plan_pre_unified(p_letter);end if;
 select * into t from letter_types where id=l.letter_type_id;
 select code into creator_code from positions where id=(app.active_assignment(l.creator_id)).position_id;
 peer:=t.category='INTERNAL' and (select level from positions where id=(app.active_assignment(l.creator_id)).position_id)=(select level from positions where id=(app.active_assignment(l.recipient_user_id)).position_id);
 ids:=coalesce(l.mandatory_approver_ids,l.signer_ids,'{}');extra:=coalesce(l.additional_approver_ids,'{}');
 if cardinality(ids)<>(case when t.category='BILLING' then 2 when t.category='EXTERNAL' or l.required_signature_count>0 then 1 else 0 end) then raise exception 'Lengkapi pejabat penyetuju wajib sesuai jenis surat.';end if;
 if peer and (cardinality(ids)>0 or cardinality(extra)>0 or l.required_signature_count>0) then raise exception 'Surat internal sesama level tanpa persetujuan dan TTD.';end if;
 if t.category='BILLING' and ids[1]=ids[2] then raise exception 'SM dan Direktur harus berbeda.';end if;
 for i in 1..cardinality(ids) loop
  actor:=ids[i];role:=case when t.category='BILLING' then case when i=1 then 'BILLING_FINANCE' else 'BILLING_DIRECTOR' end else 'CONTENT_APPROVER' end;
  if t.category<>'BILLING' and creator_code='DIR' then continue;end if;
  if actor is null or not app.approval_roles_valid(actor,array[role],l.creator_unit_id,l.letter_type_id)
    or (t.category<>'BILLING' and not app.content_approver(l.creator_id,actor)) then raise exception 'Pilih penyetuju atasan yang aktif sesuai hierarki dan unit.';end if;
  entries:=entries||jsonb_build_array(jsonb_build_object('actor',actor,'role',role,'ord',i));
 end loop;
 foreach actor in array extra loop
  if actor=any(ids) then continue;end if;
  if not app.content_approver(l.creator_id,actor) then raise exception 'Pilih penyetuju atasan yang aktif sesuai hierarki dan unit.';end if;
  entries:=entries||jsonb_build_array(jsonb_build_object('actor',actor,'role','CONTENT_APPROVER','ord',cardinality(ids)+array_position(extra,actor)));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('actor',x.actor,'roles',x.roles,'ord',x.ord) order by x.ord,x.actor),'[]') into result
 from(select e->>'actor' actor,jsonb_agg(distinct e->>'role' order by e->>'role') roles,min((e->>'ord')::integer) ord from jsonb_array_elements(entries) e group by e->>'actor') x;
 if l.content_approval_required and not peer and creator_code<>'DIR' and jsonb_array_length(result)=0 then raise exception 'Pilih pemberi persetujuan melalui Edit Draft sebelum mengajukan.';end if;
 return result;
end $$;
revoke all on function app.build_approval_plan(uuid),app.build_approval_plan_pre_unified(uuid) from public,anon,authenticated;
grant execute on function app.build_approval_plan(uuid) to service_role;

-- General approval roles now follow active organizational rank. Billing signatory rules stay intact.
create or replace function app.approval_roles_valid(p_actor uuid,p_roles text[],p_unit uuid,p_type uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare a user_assignments; code text; r text;
begin
 a:=app.active_assignment(p_actor);if a.id is null or p_roles is null or cardinality(p_roles)=0 then return false;end if;
 select positions.code into code from positions where id=a.position_id;
 foreach r in array p_roles loop
  if r is null or r not in ('FORMAL_AUTHORITY','BILLING_FINANCE','BILLING_DIRECTOR','ADDITIONAL','CONTENT_APPROVER') then return false;end if;
  if r='FORMAL_AUTHORITY' and not app.valid_signer(p_actor) then return false;
  elsif r='BILLING_FINANCE' and (code<>'SM' or not app.valid_signer(p_actor) or (a.unit_id<>p_unit and not app.authorized_approver(p_actor,p_unit,p_type))) then return false;
  elsif r='BILLING_DIRECTOR' and (code<>'DIR' or not app.valid_signer(p_actor)) then return false;
  elsif r='ADDITIONAL' and cardinality(p_roles)=1 and not app.authorized_approver(p_actor,p_unit,p_type) then return false;
  elsif r='CONTENT_APPROVER' and (code not in ('GM','SM','DIR') or (code='GM' and a.unit_id<>p_unit)) then return false;
  end if;
 end loop;
 return true;
end $$;

-- Remove the category/reviewer dependency inside the existing save chain. Keep metadata for history.
create or replace function save_letter_draft_pre_approval(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid;category uuid;
begin
 v_id:=save_letter_draft_pre_review(p_actor,p_data,p_document);
 select c.id into category from document_categories c where c.code=p_data->>'categoryCode';
 update letters set category_id=coalesce(category,category_id),reviewer_id=null,review_requested=false,review_status='NOT_REQUIRED',unified_approval=true,
 content_approval_required=approval_required_from_review or coalesce((p_data->>'approvalRequired')::boolean,false) where letters.id=v_id;
 return v_id;
end $$;
create or replace function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 return save_letter_draft_pre_optional_review(p_actor,(p_data-'reviewerId'-'reviewRequested')||jsonb_build_object('reviewRequested',false,'approvalRequired',coalesce((p_data->>'approvalRequired')::boolean,false) or coalesce((p_data->>'reviewRequested')::boolean,false) or nullif(p_data->>'reviewerId','') is not null),p_document);
end $$;
create or replace function submit_letter_for_approval(p_actor uuid,p_letter uuid,p_revision integer,p_confirm_self boolean default false) returns text
language plpgsql security invoker set search_path=public,pg_temp as $$
declare l letters;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null
 or l.revision is distinct from p_revision or l.previewed_revision is distinct from l.revision then raise exception 'Simpan dan pratinjau versi terkini sebelum mengajukan.';end if;
 if l.resubmission_required_version=l.current_version_id then raise exception 'Simpan koreksi sebagai versi baru sebelum mengajukan ulang.';end if;
 return app.submit_approval_plan(p_actor,p_letter,p_confirm_self);
end $$;
create or replace function issue_letter_number(p_letter_id uuid,p_actor uuid,p_idempotency_key text) returns number_issuances
language plpgsql security invoker set search_path=public,pg_temp as $$
begin return issue_letter_number_pre_review(p_letter_id,p_actor,p_idempotency_key);end $$;
-- Manual numbering keeps its reservation/hash/approval guards, without a separate review gate.
do $$ declare definition text;begin
 select pg_get_functiondef('activate_manual_letter_number(uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'if l.review_status not in(''NOT_REQUIRED'',''PASSED'') or (l.review_status=''PASSED'' and not app.review_passed(l.id)) then raise exception ''Pemeriksaan belum selesai.'';end if;','');
 execute definition;
end $$;
create or replace function review_letter(p_actor uuid,p_letter uuid,p_action text,p_revision integer,p_note text default null) returns text
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
 if p_action='COMMENT' then
  if nullif(trim(p_note),'') is null or length(p_note)>5000 then raise exception 'Isi catatan maksimal 5000 karakter.';end if;
  update approval_steps set comments=comments||jsonb_build_array(jsonb_build_object('actor_id',p_actor,'note',trim(p_note),'created_at',now())) where id=s.id;
  update letters set revision=revision+1 where id=l.id;
  insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,l.id,'APPROVAL_COMMENT','approval_steps',s.id::text,s.version_id);
  insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,'APPROVAL_COMMENT','Catatan persetujuan ditambahkan.',false);
  return l.status;
 end if;
 if p_action not in ('APPROVE','REJECT','REQUEST_REVISION') or p_action is null then raise exception 'Tindakan persetujuan tidak valid.';end if;
 if p_action<>'APPROVE' and nullif(trim(p_note),'') is null then raise exception 'Alasan wajib diisi.';end if;
 update approval_steps set status=case p_action when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end,decision_origin='EXPLICIT',decision_note=nullif(trim(p_note),''),decided_at=now() where id=s.id;
 if p_action='APPROVE' then dest:=app.advance_approvals(l.id);
 else
  dest:=case p_action when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end;
  update approval_steps set status='SUPERSEDED' where letter_id=l.id and cycle=l.approval_cycle and status in ('PENDING','WAITING');
  update letters set status=dest,previewed_revision=null,resubmission_required_version=case when p_action='REQUEST_REVISION' then current_version_id else resubmission_required_version end,status_reason=p_note where id=l.id;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,reason) values(p_actor,l.id,p_action,'approval_steps',s.id::text,s.version_id,p_note);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,p_action,'Keputusan persetujuan telah dicatat.',false);
 return dest;
end $$;

do $$ declare definition text;begin
 select pg_get_functiondef('restart_letter_approval(uuid,uuid,integer,text)'::regprocedure) into definition;
 execute replace(definition,'review_status=''NOT_STARTED''','review_status=''NOT_REQUIRED''');
end $$;
-- Historical review RPCs cannot create or decide a separate workflow anymore.
create or replace function decide_letter_review(p_actor uuid,p_step uuid,p_version uuid,p_revision integer,p_action text,p_note text default null) returns text
language plpgsql security invoker set search_path=public,pg_temp as $$
begin raise exception 'Pemeriksaan isi dilakukan melalui Persetujuan Surat.';end $$;
-- Remove reviewer-only live document access; creator/approval/signature/dispatch access remains unchanged.
create or replace function app.can_read_letter_for(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from app.removed_beta_letters r where r.letter_id=p_letter) and (
 app.can_read_letter_for_pre_review(p_actor,p_letter) or app.is_dispatch_recipient(p_actor,p_letter)
 or exists(select 1 from letters l where l.id=p_letter and l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(p_actor,l.creator_unit_id)))
$$;
create or replace function app.can_read_review_version(p_letter uuid,p_version uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select app.can_read_letter_for_pre_review(auth.uid(),p_letter) or app.is_dispatch_recipient(auth.uid(),p_letter,p_version)
 or exists(select 1 from letters l where l.id=p_letter and l.current_version_id=p_version and l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(auth.uid(),l.creator_unit_id))
$$;
create or replace function app.can_read_workflow_history(p_letter uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select app.can_read_letter_for_pre_review(auth.uid(),p_letter)
$$;
-- Additional flags/comments cannot be changed by direct client updates.
create function app.guard_unified_approval() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if current_user in ('anon','authenticated') then
  if tg_table_name='letters' then
   if (new.unified_approval,new.content_approval_required,new.approval_required_from_review) is distinct from (old.unified_approval,old.content_approval_required,old.approval_required_from_review) then raise exception 'Persetujuan hanya melalui alur resmi.' using errcode='42501';end if;
  elsif new.comments is distinct from old.comments then raise exception 'Catatan hanya melalui persetujuan resmi.' using errcode='42501';end if;
 end if;return new;
end $$;
create trigger letters_unified_approval_guard before update on letters for each row execute function app.guard_unified_approval();
create trigger approval_comments_guard before update on approval_steps for each row execute function app.guard_unified_approval();
revoke all on function app.guard_unified_approval() from public,anon,authenticated;

-- Explicit transition for versioned, unissued letters only. No decisions or document bytes are fabricated.
alter table review_steps drop constraint review_steps_status_check;
alter table review_steps add constraint review_steps_status_check check(status in('PENDING','PASSED','REVISION_REQUESTED','SUPERSEDED'));
do $$ declare l letters;wanted boolean;peer boolean;extras uuid[];transitioned boolean;begin
 for l in select * from letters where current_version_id is not null and finalized_at is null and (status in('DRAFT','REVISION_REQUESTED') or (status='IN_REVIEW' and review_status='WAITING')) loop
  peer:=(select category='INTERNAL' from letter_types where id=l.letter_type_id) and (select level from positions where id=(app.active_assignment(l.creator_id)).position_id)=(select level from positions where id=(app.active_assignment(l.recipient_user_id)).position_id);
  wanted:=not coalesce(peer,false) and (coalesce(l.review_requested,false) or l.reviewer_id is not null or l.review_status in('WAITING','REVISION_REQUESTED') or exists(select 1 from review_policies p join document_categories c on c.code=p.category_code where c.id=l.category_id and p.requires_review and l.review_requested is null));
  transitioned:=coalesce(l.review_requested,false) or l.reviewer_id is not null or l.review_status in('WAITING','NOT_STARTED','REVISION_REQUESTED');
  extras:=coalesce(l.additional_approver_ids,'{}');
  if wanted and l.reviewer_id is not null and app.content_approver(l.creator_id,l.reviewer_id) and not l.reviewer_id=any(extras||coalesce(l.mandatory_approver_ids,l.signer_ids,'{}')) then extras:=extras||l.reviewer_id;end if;
  update letters set status=case when l.status='IN_REVIEW' then 'DRAFT' else l.status end,unified_approval=true,content_approval_required=wanted,approval_required_from_review=wanted,additional_approver_ids=extras,review_status='NOT_REQUIRED',review_requested=false,reviewer_id=null,
    revision=revision+case when transitioned then 1 else 0 end,previewed_revision=case when transitioned then null else l.previewed_revision end,resubmission_required_version=case when l.review_status='REVISION_REQUESTED' then l.current_version_id else l.resubmission_required_version end where id=l.id;
  update approval_steps set status='SUPERSEDED' where letter_id=l.id and status in('PENDING','WAITING');
  update review_steps set status='SUPERSEDED' where letter_id=l.id and status='PENDING';
  if transitioned then insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata) values(null,l.id,'REVIEW_MERGED_INTO_APPROVAL','letters',l.id::text,l.current_version_id,jsonb_build_object('previous_review_status',l.review_status,'reviewer_id',l.reviewer_id));end if;
  if wanted then insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,'APPROVAL_RESUBMISSION','Ajukan surat melalui Persetujuan Surat.',false);end if;
 end loop;
end $$;
revoke all on function save_letter_draft(uuid,jsonb,jsonb),save_letter_draft_pre_approval(uuid,jsonb,jsonb),submit_letter_for_approval(uuid,uuid,integer,boolean),review_letter(uuid,uuid,text,integer,text),issue_letter_number(uuid,uuid,text),decide_letter_review(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb),submit_letter_for_approval(uuid,uuid,integer,boolean),review_letter(uuid,uuid,text,integer,text),issue_letter_number(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
