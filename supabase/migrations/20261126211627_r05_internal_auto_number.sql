begin;
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
 if p_action='APPROVE' then
  dest:=app.advance_approvals(l.id);
  if dest='READY_TO_ISSUE' and l.official_sender_id is not null and l.required_signature_count=0
    and l.manual_number_reservation_id is null then
   perform issue_letter_number(l.id,l.creator_id,'issue-'||l.id::text);
   dest:='NUMBERED';
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
   values(p_actor,l.id,'AUTO_NUMBER_AFTER_APPROVAL','letters',l.id::text,s.version_id,jsonb_build_object('approved_by',p_actor));
  end if;
 else
  dest:=case p_action when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end;
  update approval_steps set status='SUPERSEDED' where letter_id=l.id and cycle=l.approval_cycle and status in ('PENDING','WAITING');
  update letters set status=dest,previewed_revision=null,resubmission_required_version=case when p_action='REQUEST_REVISION' then current_version_id else resubmission_required_version end,status_reason=p_note where id=l.id;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,reason) values(p_actor,l.id,p_action,'approval_steps',s.id::text,s.version_id,p_note);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,p_action,'Keputusan persetujuan telah dicatat.',false);
 return dest;
end $$;

notify pgrst,'reload schema';
commit;
