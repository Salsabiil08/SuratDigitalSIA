-- Pertahankan pembatalan, tanpa mengizinkan pengeditan dokumen final atau reuse nomor.
create function cancel_letter_workflow(p_actor uuid,p_letter uuid,p_action text,p_reason text default null)
returns text language plpgsql set search_path=public as $$
declare l letters; t letter_types; r cancellation_requests; head uuid; basis text; needed integer; target uuid; done_count integer;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or (app.active_assignment(p_actor)).id is null then raise exception 'Akun/surat tidak valid.'; end if;
 if p_action='CANCEL_DRAFT' then
   if l.creator_id<>p_actor or l.status not in ('DRAFT','REVISION_REQUESTED') then raise exception 'Hanya pembuat dapat membatalkan draft yang dapat diedit.'; end if;
   if nullif(trim(p_reason),'') is null then raise exception 'Alasan pembatalan wajib.'; end if;
   update letters set status='CANCELLED',status_reason=p_reason where id=l.id;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,status_before,status_after,reason) values(p_actor,l.id,'CANCEL_DRAFT','letters',l.id::text,l.status,'CANCELLED',p_reason);
   return 'CANCELLED';
 end if;
 if l.status<>'NUMBERED' then raise exception 'Surat belum bernomor atau sudah dibatalkan.'; end if;
 select * into t from letter_types where id=l.letter_type_id;
 select * into r from cancellation_requests where letter_id=l.id and status='PENDING' order by created_at desc limit 1 for update;
 if p_action='REQUEST' then
   if l.creator_id<>p_actor then raise exception 'Hanya pembuat dapat mengajukan pembatalan.'; end if;
   if r.id is not null then return 'PENDING'; end if;
   if nullif(trim(p_reason),'') is null then raise exception 'Alasan pembatalan wajib.'; end if;
   insert into cancellation_requests(letter_id,requested_by,reason,status) values(l.id,p_actor,p_reason,'PENDING') returning * into r;
   if t.category='INTERNAL' then
     select a.profile_id into head from organizational_units u join user_assignments a on a.id=u.head_assignment_id where u.id=l.creator_unit_id and a.is_active;
     if head is null then raise exception 'Kepala unit belum ditetapkan untuk otorisasi pembatalan.'; end if;
     insert into cancellation_authorizations(request_id,authorizer_id,authority_basis) values(r.id,head,'UNIT_HEAD');
     insert into cancellation_authorizations(request_id,authorizer_id,authority_basis,delegation_id)
     select r.id,a.profile_id,'DESIGNATED_OFFICIAL',d.id from authority_delegations d join user_assignments a on a.id=d.grantee_assignment_id join organizational_units u on u.head_assignment_id=d.grantor_assignment_id
     where d.scope_unit_id=l.creator_unit_id and u.id=l.creator_unit_id and d.is_active and a.is_active and d.authority_type='LETTER_CANCELLATION' and (d.valid_from is null or d.valid_from<=current_date) and (d.valid_until is null or d.valid_until>=current_date) and a.profile_id<>head;
   else
     if cardinality(l.signer_ids)<>(case when t.category='BILLING' then 2 else 1 end) then raise exception 'Penandatangan surat lama belum lengkap untuk otorisasi.'; end if;
     insert into cancellation_authorizations(request_id,authorizer_id,authority_basis)
     select r.id,s,case when t.category='BILLING' then case when ord=1 then 'SM_FINANCE' else 'DIRECTOR' end else 'SIGNING_OFFICIAL' end from unnest(l.signer_ids) with ordinality a(s,ord);
   end if;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,reason) values(p_actor,l.id,'CANCELLATION_REQUESTED','cancellation_requests',r.id::text,p_reason);
   return 'PENDING';
 end if;
 if r.id is null or p_action not in ('APPROVE','DECLINE') then raise exception 'Permohonan pembatalan tidak aktif.'; end if;
 if not exists(select 1 from cancellation_authorizations where request_id=r.id and authorizer_id=p_actor and decision is null) then raise exception 'Akun ini bukan pemegang otorisasi pembatalan.'; end if;
 if t.category='INTERNAL' then
   if not exists(select 1 from cancellation_authorizations ca left join authority_delegations d on d.id=ca.delegation_id where ca.request_id=r.id and ca.authorizer_id=p_actor and ((ca.authority_basis='UNIT_HEAD' and exists(select 1 from organizational_units u join user_assignments a on a.id=u.head_assignment_id where u.id=l.creator_unit_id and a.profile_id=p_actor and a.is_active)) or (ca.authority_basis='DESIGNATED_OFFICIAL' and d.is_active and (d.valid_from is null or d.valid_from<=current_date) and (d.valid_until is null or d.valid_until>=current_date)))) then raise exception 'Kewenangan pembatalan sudah tidak aktif.'; end if;
 elsif not app.valid_signer(p_actor) then raise exception 'Pejabat penandatangan sudah tidak aktif.'; end if;
 if p_action='DECLINE' and nullif(trim(p_reason),'') is null then raise exception 'Alasan penolakan wajib.'; end if;
 update cancellation_authorizations set decision=case when p_action='APPROVE' then 'APPROVED' else 'DECLINED' end,note=p_reason,decided_at=now() where request_id=r.id and authorizer_id=p_actor and decision is null;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,reason) values(p_actor,l.id,'CANCELLATION_'||p_action,'cancellation_requests',r.id::text,p_reason);
 if p_action='DECLINE' then update cancellation_requests set status='DECLINED' where id=r.id; return 'DECLINED'; end if;
 needed:=case when t.category='BILLING' then 2 else 1 end;
 select count(distinct authorizer_id) into done_count from cancellation_authorizations where request_id=r.id and decision='APPROVED';
 if done_count>=needed then
   perform cancel_numbered_letter(l.id,p_actor,r.reason);
   update cancellation_requests set status='EXECUTED',executed_at=now() where id=r.id;
   update signature_requests set status='CANCELLED' where letter_id=l.id and status in ('PENDING','WAITING');
   return 'EXECUTED';
 end if;
 return 'PENDING';
end $$;
revoke all on function cancel_letter_workflow(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function cancel_letter_workflow(uuid,uuid,text,text) to service_role;
