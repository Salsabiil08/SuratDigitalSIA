begin;
alter table public.letters add column official_sender_id uuid references public.profiles(id);
alter table public.letters add column origin_city text;

create function app.r05_internal_senders(creator uuid, recipient uuid) returns setof uuid
language sql stable security definer set search_path=public,pg_temp as $$
 with recursive memberships as (
   select p.id, a.unit_id, a.id as assignment_id,a.supervisor_assignment_id, pos.code,
          array_position(array['STF','GM','SM','DIR'],pos.code) as rank
   from profiles p
   cross join lateral app.active_assignment(p.id) a
   join positions pos on pos.id=a.position_id and pos.is_active
   join organizational_units u on u.id=a.unit_id and u.is_active
 ), levels as (
   select c.rank as creator_rank,r.rank as recipient_rank,c.unit_id
   from memberships c join memberships r on r.id=recipient
   where c.id=creator and creator<>recipient and c.rank is not null and r.rank is not null
 ), supervisors(assignment_id,supervisor_assignment_id) as (
   select m.assignment_id,m.supervisor_assignment_id from memberships m where m.id=creator
   union
   select m.assignment_id,m.supervisor_assignment_id from memberships m join supervisors s on m.assignment_id=s.supervisor_assignment_id
 ), hierarchy(id,parent_id) as (
   select u.id,u.parent_id from organizational_units u join levels l on l.unit_id=u.id
   union
   select u.id,u.parent_id from organizational_units u join hierarchy h on h.parent_id=u.id
   where u.is_active
 )
 select creator from levels where creator_rank>=recipient_rank
 union
 select m.id from memberships m cross join levels l
 where l.creator_rank<l.recipient_rank and m.rank=l.recipient_rank and m.id<>recipient
 and (exists(select 1 from hierarchy h where h.id=m.unit_id)
      or exists(select 1 from supervisors s where s.assignment_id=m.assignment_id))
$$;
revoke all on function app.r05_internal_senders(uuid,uuid) from public,anon,authenticated;
grant execute on function app.r05_internal_senders(uuid,uuid) to service_role;

create or replace function app.build_approval_plan(p_letter uuid) returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare l letters;t letter_types;ids uuid[];extra uuid[];actor uuid;role text;i integer;entries jsonb:='[]';result jsonb;creator_code text;peer boolean;
begin
 select * into l from letters where id=p_letter;
 if not l.unified_approval then return app.build_approval_plan_pre_unified(p_letter);end if;
 select * into t from letter_types where id=l.letter_type_id;
 select code into creator_code from positions where id=(app.active_assignment(l.creator_id)).position_id;
 if l.official_sender_id is not null and t.category='INTERNAL' then
  if l.required_signature_count<>0 or l.stamp_area is not null
     or not exists(select 1 from app.r05_internal_senders(l.creator_id,l.recipient_user_id) s where s=l.official_sender_id)
  then raise exception 'Pengirim resmi internal sudah tidak berwenang.';end if;
  if l.official_sender_id=l.creator_id then return '[]';end if;
  return jsonb_build_array(jsonb_build_object('actor',l.official_sender_id,'roles',jsonb_build_array('R05_INTERNAL_SENDER'),'ord',1));
 end if;
 if l.official_sender_id is not null and t.category='EXTERNAL' then
  if l.required_signature_count<>1 or l.signer_ids is distinct from array[l.official_sender_id]
     or not app.valid_signer(l.official_sender_id)
  then raise exception 'Pilih pengirim resmi SM atau Direktur yang berwenang.';end if;
  if l.official_sender_id=l.creator_id then return '[]';end if;
  return jsonb_build_array(jsonb_build_object('actor',l.official_sender_id,'roles',jsonb_build_array('FORMAL_AUTHORITY'),'ord',1));
 end if;
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
create or replace function app.approval_roles_valid(p_actor uuid,p_roles text[],p_unit uuid,p_type uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare a user_assignments; code text; r text;
begin
 a:=app.active_assignment(p_actor);if a.id is null or p_roles is null or cardinality(p_roles)=0 then return false;end if;
 select positions.code into code from positions where id=a.position_id;
 foreach r in array p_roles loop
  if r is null or r not in ('FORMAL_AUTHORITY','BILLING_FINANCE','BILLING_DIRECTOR','ADDITIONAL','CONTENT_APPROVER','R05_INTERNAL_SENDER') then return false;end if;
  if r='FORMAL_AUTHORITY' and not app.valid_signer(p_actor) then return false;
  elsif r='BILLING_FINANCE' and (code<>'SM' or not app.valid_signer(p_actor) or (a.unit_id<>p_unit and not app.authorized_approver(p_actor,p_unit,p_type))) then return false;
  elsif r='BILLING_DIRECTOR' and (code<>'DIR' or not app.valid_signer(p_actor)) then return false;
  elsif r='ADDITIONAL' and cardinality(p_roles)=1 and not app.authorized_approver(p_actor,p_unit,p_type) then return false;
  elsif r='R05_INTERNAL_SENDER' and code not in ('GM','SM','DIR') then return false;
  elsif r='CONTENT_APPROVER' and (code not in ('GM','SM','DIR') or (code='GM' and a.unit_id<>p_unit)) then return false;
  end if;
 end loop;
 return true;
end $$;

create or replace function save_letter_draft_pre_approval(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid;category uuid;
begin
 v_id:=save_letter_draft_pre_review(p_actor,p_data,p_document);
 select c.id into category from document_categories c where c.code=p_data->>'categoryCode';
 update letters set category_id=coalesce(category,category_id),reviewer_id=null,review_requested=false,review_status='NOT_REQUIRED',unified_approval=true,
 content_approval_required=approval_required_from_review or coalesce((p_data->>'approvalRequired')::boolean,false) where letters.id=v_id;
 if p_data ? 'officialSenderId' then
  update letters set official_sender_id=(p_data->>'officialSenderId')::uuid,
      origin_city=nullif(trim(p_data->>'originCity'),'')
  where id=v_id;
  if (select official_sender_id is null from letters where id=v_id) then
   raise exception 'Pengirim resmi wajib diisi.';
  end if;
 end if;
 return v_id;
end $$;
create or replace function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_data ? 'officialSenderId' then
  if nullif(p_data->>'officialSenderId','') is null then raise exception 'Pengirim resmi wajib diisi.';end if;
  if p_data->>'letterTypeCode'='IN' then
   p_data:=(p_data-'stampArea')||jsonb_build_object('signerIds','[]'::jsonb,'mandatoryApproverIds','[]'::jsonb,'additionalApproverIds','[]'::jsonb,'areas','[]'::jsonb,'signatureMode','IN_APP');
  elsif p_data->>'letterTypeCode'='KRE' then
   if nullif(trim(p_data->>'originCity'),'') is null then raise exception 'Kota surat eksternal wajib diisi.';end if;
   p_data:=p_data||jsonb_build_object('signerIds',jsonb_build_array(p_data->>'officialSenderId'),'mandatoryApproverIds','[]'::jsonb,'additionalApproverIds','[]'::jsonb,'signatureMode','IN_APP');
  else raise exception 'Jenis surat belum mendukung pengirim resmi R.05.';end if;
 end if;
 return save_letter_draft_pre_optional_review(p_actor,(p_data-'reviewerId'-'reviewRequested')||jsonb_build_object('reviewRequested',false,'approvalRequired',coalesce((p_data->>'approvalRequired')::boolean,false) or coalesce((p_data->>'reviewRequested')::boolean,false) or nullif(p_data->>'reviewerId','') is not null),p_document);
end $$;
create or replace function app.can_dispatch_letter(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (app.active_assignment(p_actor)).id is not null and exists(select 1 from letters l join letter_types t on t.id=l.letter_type_id where l.id=p_letter and t.category='INTERNAL'
 and (case when l.official_sender_id is not null then l.official_sender_id=p_actor and exists(select 1 from app.r05_internal_senders(l.creator_id,l.recipient_user_id) s where s=p_actor) else (l.creator_id=p_actor or (l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(p_actor,l.creator_unit_id))) end))
$$;
create or replace function app.can_read_letter_for_pre_review(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from profiles where id=p_actor and is_active) and exists (
 select 1 from letters l where l.id=p_letter and (
 l.creator_id=p_actor or l.signer_id=p_actor or (l.official_sender_id=p_actor and l.finalized_at is not null)

 or exists(select 1 from approval_steps a where a.letter_id=l.id and a.approver_id=p_actor and a.status<>'WAITING' and a.version_id=l.current_version_id and (a.required_roles is null or (a.cycle=l.approval_cycle and app.approval_roles_valid(p_actor,a.required_roles,l.creator_unit_id,l.letter_type_id))))
 or exists(select 1 from signature_requests s where s.letter_id=l.id and s.signer_id=p_actor)
 or exists(select 1 from cancellation_requests cr where cr.letter_id=l.id and (cr.requested_by=p_actor or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=p_actor)))
 or exists(select 1 from dispositions d where d.source_dispatch_id is null and (d.letter_id=l.id and d.recipient_id=p_actor and (not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))) or (d.source_dispatch_id is null and d.response_letter_id=l.id and d.giver_id=p_actor and d.submitted_at is not null and (l.recipient_user_id is distinct from p_actor or not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))))
 ))
$$;

create function app.guard_r05_sender() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (new.official_sender_id,new.origin_city) is distinct from (old.official_sender_id,old.origin_city)
    and (current_user in ('authenticated','anon') or old.finalized_at is not null or old.official_number is not null)
 then raise exception 'Pengirim resmi hanya boleh ditetapkan pada draf melalui SIADocs.' using errcode='42501';end if;
 return new;
end $$;
create trigger letters_r05_sender_guard before update on letters for each row execute function app.guard_r05_sender();
revoke all on function app.guard_r05_sender() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
