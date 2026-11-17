create or replace function app.active_assignment(p_actor uuid)
returns user_assignments language sql stable security definer set search_path = public as $$
 select a from user_assignments a join profiles p on p.id=a.profile_id join positions po on po.id=a.position_id and po.is_active join organizational_units u on u.id=a.unit_id and u.is_active
 where a.profile_id=p_actor and p.is_active and a.is_active
 and (a.start_date is null or a.start_date<=(now() at time zone 'Asia/Jakarta')::date) and (a.end_date is null or a.end_date>=(now() at time zone 'Asia/Jakarta')::date)
 order by a.start_date desc nulls last limit 1
$$;

-- Pengetatan input nullable dan delegasi yang sudah berubah.
create or replace function save_letter_draft(p_actor uuid, p_data jsonb, p_document jsonb)
returns uuid language plpgsql set search_path=public as $$
declare
 l letters; t letter_types; a user_assignments; s uuid; n integer; v uuid; no integer;
 d date; ids uuid[]; b jsonb; old_date date; new_id uuid; expected integer; bank uuid;
begin
 a:=app.active_assignment(p_actor);
 if a.id is null then raise exception 'Akun tidak memiliki penugasan aktif.'; end if;
 select * into t from letter_types where code=p_data->>'letterTypeCode' and is_active;
 if t.id is null or nullif(trim(p_data->>'subject'),'') is null then raise exception 'Jenis surat dan perihal wajib diisi.'; end if;
 d:=(p_data->>'letterDate')::date;
 if d is null then raise exception 'Tanggal surat wajib diisi.'; end if;
 if nullif(p_data->>'id','') is not null then
   select * into l from letters where id=(p_data->>'id')::uuid for update;
   if l.id is null or l.creator_id<>p_actor or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null then raise exception 'Draft tidak dapat diubah oleh akun ini.'; end if;
   expected:=(p_data->>'revision')::integer;
   if expected is distinct from l.revision then raise exception 'Draft telah berubah. Muat ulang sebelum menyimpan.'; end if;
   if l.letter_type_id<>t.id then raise exception 'Jenis surat tidak dapat diganti setelah draft dibuat.'; end if;
   old_date:=l.letter_date;
 end if;
 if d < (now() at time zone 'Asia/Jakarta')::date and (l.id is null or d is distinct from old_date) then
   if not app.can_backdate(p_actor) or nullif(trim(p_data->>'dateReason'),'') is null then raise exception 'Tanggal mundur memerlukan kewenangan GM/SM/Direktur dan alasan.'; end if;
 end if;
 select coalesce(array_agg(x::uuid),'{}') into ids from jsonb_array_elements_text(coalesce(p_data->'signerIds','[]')) x;
 n:=cardinality(ids);
 if n<>(select count(distinct x) from unnest(ids) x) then raise exception 'Penandatangan harus berbeda.'; end if;
 foreach s in array ids loop
   if not app.valid_signer(s) then raise exception 'Penandatangan harus pejabat SM/Direktur aktif yang berwenang.'; end if;
 end loop;
 if t.category='INTERNAL' then
   if n>1 or not exists(select 1 from profiles where id=(p_data->>'recipientUserId')::uuid and is_active) then raise exception 'Pilih penerima internal aktif; maksimal satu TTD formal.'; end if;
 else
   if nullif(trim(p_data->>'recipientName'),'') is null or nullif(trim(p_data->>'recipientOrg'),'') is null or nullif(trim(p_data->>'recipientAddress'),'') is null then raise exception 'Nama, instansi, dan alamat penerima eksternal wajib diisi.'; end if;
   if t.category='EXTERNAL' and n<>1 then raise exception 'Surat eksternal wajib satu penandatangan.'; end if;
 end if;
 if t.category='BILLING' then
   if t.creator_unit_id is distinct from a.unit_id or n<>2 then raise exception 'Tagihan khusus Finance dan wajib dua penandatangan.'; end if;
   if not exists(select 1 from app.active_assignment(ids[1]) x join positions p on p.id=x.position_id join organizational_units u on u.id=x.unit_id where p.code='SM' and u.id=t.creator_unit_id)
   or not exists(select 1 from app.active_assignment(ids[2]) x join positions p on p.id=x.position_id where p.code='DIR') then raise exception 'Urutan tagihan: SM Finance lalu Direktur.'; end if;
   b:=p_data->'billing';
   bank:=nullif(b->>'bankId','')::uuid;
   if bank is null and nullif(trim(b->>'bankName'),'') is not null then
     select id into bank from master_bank where lower(name)=lower(trim(b->>'bankName')) and is_active limit 1;
     if bank is null then insert into master_bank(name,is_active) values(trim(b->>'bankName'),true) returning id into bank; end if;
   end if;
   if b is null or coalesce(jsonb_array_length(b->'items'),0)<2 or nullif(b->>'accountNumber','') is null or nullif(b->>'accountHolder','') is null
   or not exists(select 1 from master_bank where id=bank and is_active)
   or exists(select 1 from jsonb_array_elements(b->'items') i where (i->>'amount')::numeric<=0 or nullif(trim(i->>'description'),'') is null) then raise exception 'Rincian tagihan dan rekening tidak lengkap.'; end if;
 end if;
 if coalesce(p_data->>'signatureMode','') not in ('IN_APP','EXTERNAL') then raise exception 'Pilih jalur TTD.'; end if;
 if nullif(p_document->>'path','') is null or nullif(p_document->>'hash','') is null or p_document->>'format' not in ('PDF','DOCX') then raise exception 'Dokumen belum tersimpan di Supabase.'; end if;
 if coalesce((select sum((i->>'size')::bigint) from jsonb_array_elements(coalesce(p_document->'attachments','[]')) i),0)+coalesce((select sum(size_bytes) from letter_attachments where letter_id=l.id),0)>26214400 then raise exception 'Total lampiran maksimal 25 MB.'; end if;
 if l.id is null then
   insert into letters(letter_type_id,source,subject,creator_id,creator_unit_id,recipient_type,status,required_signature_count)
   values(t.id,p_data->>'source',p_data->>'subject',p_actor,a.unit_id,case when t.category='INTERNAL' then 'INTERNAL_USER' else 'EXTERNAL' end,'DRAFT',n) returning * into l;
 end if;
 update letters set subject=trim(p_data->>'subject'), letter_date=d, date_change_reason=p_data->>'dateReason',
 recipient_user_id=case when t.category='INTERNAL' then (p_data->>'recipientUserId')::uuid else null end,
 recipient_external_name=case when t.category<>'INTERNAL' then p_data->>'recipientName' else null end,
 recipient_external_org=case when t.category<>'INTERNAL' then p_data->>'recipientOrg' else null end,
 recipient_external_address=case when t.category<>'INTERNAL' then p_data->>'recipientAddress' else null end,
 signer_id=ids[1], signer_ids=ids, required_signature_count=n, signature_mode=p_data->>'signatureMode',
 signature_status='NOT_STARTED',signature_areas=coalesce(p_data->'areas','[]'),stamp_area=nullif(p_data->'stampArea','null'),number_area=nullif(p_data->'numberArea','null'),
 revision=revision+1, previewed_revision=null, updated_at=now() where id=l.id;
 select coalesce(max(version_no),0)+1 into no from letter_versions where letter_id=l.id;
 update letter_versions set is_current=false where letter_id=l.id and is_current;
 insert into letter_versions(letter_id,version_no,version_kind,storage_path,file_format,file_hash,content_html,created_by,is_current,original_name)
 values(l.id,no,'DRAFT',p_document->>'path',p_document->>'format',p_document->>'hash',p_data->>'content',p_actor,true,p_document->>'name') returning id into v;
 update letters set current_version_id=v where id=l.id;
 insert into letter_attachments(letter_id,file_name,storage_path,mime_type,size_bytes,uploaded_by)
 select l.id,i->>'name',i->>'path',i->>'mime',(i->>'size')::bigint,p_actor from jsonb_array_elements(coalesce(p_document->'attachments','[]')) i;
 if b is not null then
   insert into billing_details(letter_id,bank_id,payee_name,account_number,total_amount,total_in_words)
   values(l.id,bank,b->>'accountHolder',b->>'accountNumber',(select sum((i->>'amount')::numeric) from jsonb_array_elements(b->'items') i),b->>'totalInWords')
   on conflict(letter_id) do update set bank_id=excluded.bank_id,payee_name=excluded.payee_name,account_number=excluded.account_number,total_amount=excluded.total_amount,total_in_words=excluded.total_in_words;
   delete from billing_items where letter_id=l.id;
   insert into billing_items(letter_id,line_no,description,amount) select l.id,ord,i->>'description',(i->>'amount')::numeric from jsonb_array_elements(b->'items') with ordinality as j(i,ord);
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
 values(p_actor,l.id,case when old_date is distinct from d then 'LETTER_DATE_SET' else 'SAVE_DRAFT' end,'letters',l.id::text,v,jsonb_build_object('date_before',old_date,'date_after',d,'reason',p_data->>'dateReason','revision',l.revision+1));
 return l.id;
end $$;

create or replace function finalize_letter(p_actor uuid,p_letter uuid,p_revision integer,p_external_confirmed boolean)
returns void language plpgsql set search_path=public as $$
declare l letters;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null or l.status<>'NUMBERED' or l.revision is distinct from p_revision then raise exception 'Surat/versi tidak dapat difinalisasi oleh akun ini.'; end if;
 if l.finalized_at is not null then return; end if;
 if not exists(select 1 from letter_versions where id=l.current_version_id and version_kind in ('NUMBERED','SIGNED') and storage_path is not null and file_hash is not null) then raise exception 'La­ngkah penyimpanan dokumen bernomor belum selesai.'; end if;
 if l.required_signature_count>0 then
   if l.signature_mode='IN_APP' and (l.signature_status<>'UPLOADED' or (select count(*) from signature_requests where letter_id=l.id and status='UPLOADED')<>l.required_signature_count) then raise exception 'Seluruh TTD wajib belum selesai.'; end if;
   if l.signature_mode='EXTERNAL' and p_external_confirmed is distinct from true then raise exception 'Konfirmasi pengesahan di luar sistem wajib.'; end if;
 end if;
 update letters set finalized_at=now(),finalized_by=p_actor,revision=revision+1,updated_at=now() where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata) values(p_actor,l.id,'FINALIZE','letters',l.id::text,l.current_version_id,jsonb_build_object('external_confirmation',p_external_confirmed));
end $$;

create or replace function record_signature(p_actor uuid,p_request uuid,p_revision integer,p_previous_version uuid,p_document jsonb,p_method text,p_image_path text default null,p_stamp_path text default null)
returns uuid language plpgsql set search_path=public as $$
declare l letters; s signature_requests; v uuid; no integer; remaining integer;
begin
 select * into s from signature_requests where id=p_request;
 select * into l from letters where id=s.letter_id for update;
 select * into s from signature_requests where id=p_request for update;
 if s.id is null or s.signer_id<>p_actor or not app.valid_signer(p_actor) or s.status<>'PENDING' or l.status<>'NUMBERED' or l.signature_mode<>'IN_APP' or l.finalized_at is not null then raise exception 'Anda bukan penandatangan aktif.'; end if;
 if not exists(select 1 from letter_versions where id=l.current_version_id and version_kind in ('NUMBERED','SIGNED')) then raise exception 'Dokumen bernomor belum tersimpan.'; end if;
 if l.revision is distinct from p_revision or l.current_version_id is distinct from p_previous_version then raise exception 'Dokumen telah berubah. Preview ulang sebelum tanda tangan.'; end if;
 if exists(select 1 from signature_requests where letter_id=l.id and sign_order<s.sign_order and status<>'UPLOADED') then raise exception 'Tanda tangan sebelumnya belum selesai.'; end if;
 if coalesce(p_method,'') not in ('IMAGE','WET_UPLOAD') or nullif(p_document->>'path','') is null or nullif(p_document->>'hash','') is null then raise exception 'Berkas hasil belum tersimpan.'; end if;
 if p_method='IMAGE' and nullif(p_image_path,'') is null then raise exception 'Gambar TTD wajib.'; end if;
 select coalesce(max(version_no),0)+1 into no from letter_versions where letter_id=l.id;
 update letter_versions set is_current=false where letter_id=l.id and is_current;
 insert into letter_versions(letter_id,version_no,version_kind,storage_path,file_format,file_hash,created_by,is_current)
 values(l.id,no,'SIGNED',p_document->>'path',p_document->>'format',p_document->>'hash',p_actor,true) returning id into v;
 update signature_requests set status='UPLOADED',signed_version_id=v,uploaded_at=now(),stamp_included=p_stamp_path is not null,signature_image_path=p_image_path,stamp_image_path=p_stamp_path,method=p_method where id=s.id;
 select count(*) into remaining from signature_requests where letter_id=l.id and status in ('PENDING','WAITING');
 update signature_requests set status='PENDING' where id=(select id from signature_requests where letter_id=l.id and status='WAITING' order by sign_order limit 1);
 update letters set current_version_id=v,revision=revision+1,signature_status=case when remaining=0 then 'UPLOADED' else 'WAITING' end,updated_at=now() where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata) values(p_actor,l.id,'SIGNATURE_APPLIED','signature_requests',s.id::text,v,jsonb_build_object('method',p_method,'hash',p_document->>'hash','order',s.sign_order));
 if p_stamp_path is not null then insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,l.id,'STAMP_APPLIED','letters',l.id::text,v); end if;
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,'SIGNATURE_APPLIED','Dokumen bertanda tangan telah tersimpan.',false);
 return v;
end $$;

-- Pertahankan pembatalan, tanpa mengizinkan pengeditan dokumen final atau reuse nomor.
create or replace function cancel_letter_workflow(p_actor uuid,p_letter uuid,p_action text,p_reason text default null)
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
     where d.scope_unit_id=l.creator_unit_id and u.id=l.creator_unit_id and d.is_active and a.is_active and d.authority_type='LETTER_CANCELLATION' and (d.valid_from is null or d.valid_from<=(now() at time zone 'Asia/Jakarta')::date) and (d.valid_until is null or d.valid_until>=(now() at time zone 'Asia/Jakarta')::date) and a.profile_id<>head;
   else
     if cardinality(l.signer_ids)<>(case when t.category='BILLING' then 2 else 1 end) then raise exception 'Penandatangan surat lama belum lengkap untuk otorisasi.'; end if;
     insert into cancellation_authorizations(request_id,authorizer_id,authority_basis)
     select r.id,s,case when t.category='BILLING' then case when ord=1 then 'SM_FINANCE' else 'DIRECTOR' end else 'SIGNING_OFFICIAL' end from unnest(l.signer_ids) with ordinality a(s,ord);
   end if;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,reason) values(p_actor,l.id,'CANCELLATION_REQUESTED','cancellation_requests',r.id::text,p_reason);
   return 'PENDING';
 end if;
 if r.id is null or coalesce(p_action,'') not in ('APPROVE','DECLINE') then raise exception 'Permohonan pembatalan tidak aktif.'; end if;
 if not exists(select 1 from cancellation_authorizations where request_id=r.id and authorizer_id=p_actor and decision is null) then raise exception 'Akun ini bukan pemegang otorisasi pembatalan.'; end if;
 if t.category='INTERNAL' then
   if not exists(select 1 from cancellation_authorizations ca left join authority_delegations d on d.id=ca.delegation_id where ca.request_id=r.id and ca.authorizer_id=p_actor and ((ca.authority_basis='UNIT_HEAD' and exists(select 1 from organizational_units u join user_assignments a on a.id=u.head_assignment_id where u.id=l.creator_unit_id and a.profile_id=p_actor and a.is_active)) or (ca.authority_basis='DESIGNATED_OFFICIAL' and d.scope_unit_id=l.creator_unit_id and d.grantor_assignment_id=(select head_assignment_id from organizational_units where id=l.creator_unit_id) and exists(select 1 from user_assignments a where a.id=d.grantee_assignment_id and a.profile_id=p_actor and a.is_active) and d.is_active and (d.valid_from is null or d.valid_from<=(now() at time zone 'Asia/Jakarta')::date) and (d.valid_until is null or d.valid_until>=(now() at time zone 'Asia/Jakarta')::date)))) then raise exception 'Kewenangan pembatalan sudah tidak aktif.'; end if;
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
