begin;
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
  elsif p_data->>'letterTypeCode'='Tag' then
   if p_data->>'officialSenderId' is distinct from p_data->'signerIds'->>0
   or (app.active_assignment((p_data->>'officialSenderId')::uuid)).unit_id is distinct from
      (select creator_unit_id from letter_types where code='Tag') then
    raise exception 'Pengirim tagihan wajib SM Finance.';
   end if;
   p_data:=p_data||jsonb_build_object('mandatoryApproverIds',p_data->'signerIds','additionalApproverIds','[]'::jsonb,'signatureMode','IN_APP');
  else raise exception 'Jenis surat belum mendukung pengirim resmi R.05.';end if;
 end if;
 return save_letter_draft_pre_optional_review(p_actor,(p_data-'reviewerId'-'reviewRequested')||jsonb_build_object('reviewRequested',false,'approvalRequired',coalesce((p_data->>'approvalRequired')::boolean,false) or coalesce((p_data->>'reviewRequested')::boolean,false) or nullif(p_data->>'reviewerId','') is not null),p_document);
end $$;

create table public.r05_signing_consents (
 letter_id uuid not null references public.letters(id),
 approval_version_id uuid not null references public.letter_versions(id),
 approval_cycle integer not null,
 signer_id uuid not null references public.profiles(id),
 signature_path text not null,
 signature_hash text not null,
 stamp_path text,
 stamp_hash text,
 authorized_at timestamptz not null default now(),
 primary key(letter_id,approval_cycle,signer_id)
);
alter table public.r05_signing_consents enable row level security;
revoke all on public.r05_signing_consents from public,anon,authenticated;
grant all on public.r05_signing_consents to service_role;

create function public.confirm_r05_signing(p_actor uuid,p_letter uuid,p_revision integer,p_mode text,p_stamp boolean,p_note text default null)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare l letters; signature official_signing_assets; stamp official_signing_assets; dest text;
begin
 -- Match activation's lock order for old manual reservations.
 perform 1 from manual_number_reservations where letter_id=p_letter for update;
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.official_sender_id is null or l.finalized_at is not null
 or l.revision is distinct from p_revision or not app.valid_signer(p_actor)
 or not coalesce(p_actor=any(l.signer_ids),false)
 then raise exception 'Anda bukan penandatangan aktif untuk versi ini.';end if;
 select * into signature from official_signing_assets where owner_id=p_actor and kind='SIGNATURE';
 if signature.owner_id is null then raise exception 'Unggah TTD di Master Pengesahan terlebih dahulu.';end if;
 if p_stamp then
  select * into stamp from official_signing_assets where owner_id=p_actor and kind='STAMP';
  if stamp.owner_id is null then raise exception 'Unggah stempel di Master Pengesahan terlebih dahulu.';end if;
 end if;
 if p_mode='SUBMIT' and l.creator_id=p_actor and l.required_signature_count=2 then
  dest:=submit_letter_for_approval(p_actor,p_letter,p_revision,true);
 elsif p_mode='APPROVE' then
  dest:=review_letter(p_actor,p_letter,'APPROVE',p_revision,p_note);
 elsif p_mode='SELF' and l.creator_id=p_actor and l.official_sender_id=p_actor and l.required_signature_count=1
   and l.status='READY_TO_ISSUE' and jsonb_array_length(l.approval_plan)=0 then
  dest:=l.status;
 else raise exception 'Tindakan pengesahan tidak sesuai tahap surat.';
 end if;
 select * into l from letters where id=p_letter;
 insert into r05_signing_consents(letter_id,approval_version_id,approval_cycle,signer_id,signature_path,signature_hash,stamp_path,stamp_hash)
 values(l.id,l.approval_plan_version,l.approval_cycle,p_actor,signature.storage_path,signature.file_hash,stamp.storage_path,stamp.file_hash);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
 values(p_actor,l.id,'SIGNING_AUTHORIZED','letters',l.id::text,l.approval_plan_version,jsonb_build_object('approval_cycle',l.approval_cycle,'stamp',p_stamp));
 if dest='READY_TO_ISSUE' then
  if exists(select 1 from unnest(l.signer_ids) signer where not exists(
   select 1 from r05_signing_consents c where c.letter_id=l.id and c.approval_cycle=l.approval_cycle and c.approval_version_id=l.approval_plan_version and c.signer_id=signer
  )) then raise exception 'Otorisasi seluruh penandatangan belum tercatat.';end if;
  if l.manual_number_reservation_id is null then
   perform issue_letter_number(l.id,l.creator_id,'issue-'||l.id::text);
  else
   perform activate_manual_letter_number(l.id,l.creator_id);
  end if;
  return 'NUMBERED';
 end if;
 return dest;
end $$;

create function public.record_r05_authorized_signature(
 p_request uuid,p_revision integer,p_previous uuid,p_document jsonb
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s signature_requests; l letters; c r05_signing_consents;
begin
 select * into s from signature_requests where id=p_request;
 select * into l from letters where id=s.letter_id for update;
 select * into c from r05_signing_consents where letter_id=l.id and approval_cycle=l.approval_cycle
  and approval_version_id=l.approval_plan_version and signer_id=s.signer_id;
 if c.signer_id is null or l.official_sender_id is null then raise exception 'Otorisasi TTD versi ini belum tersedia.';end if;
 return record_signature(c.signer_id,p_request,p_revision,p_previous,p_document,'IMAGE',c.signature_path,c.stamp_path);
end $$;

revoke all on function public.confirm_r05_signing(uuid,uuid,integer,text,boolean,text),
 public.record_r05_authorized_signature(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_r05_signing(uuid,uuid,integer,text,boolean,text),
 public.record_r05_authorized_signature(uuid,integer,uuid,jsonb) to service_role;
create function app.require_r05_numbering_consent() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if old.official_number is null and new.official_number is not null
  and new.official_sender_id is not null and new.required_signature_count>0
  and exists(select 1 from unnest(new.signer_ids) signer where not exists(
   select 1 from r05_signing_consents c where c.letter_id=new.id and c.approval_cycle=new.approval_cycle
    and c.approval_version_id=new.approval_plan_version and c.signer_id=signer
  ))
 then raise exception 'Nomor surat memerlukan otorisasi seluruh penandatangan.';end if;
 return new;
end $$;
create trigger letters_r05_numbering_consent_guard before update of official_number on letters
 for each row execute function app.require_r05_numbering_consent();
revoke all on function app.require_r05_numbering_consent() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
