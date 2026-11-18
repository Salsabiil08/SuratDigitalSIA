alter table letter_versions add column content_format text not null default 'TEXT' check(content_format in ('TEXT','HTML'));
create or replace function save_letter_draft_core(p_actor uuid, p_data jsonb, p_document jsonb)
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
   if not exists(select 1 from app.active_assignment(ids[1]) x join positions p on p.id=x.position_id join organizational_units u on u.id=x.unit_id where p.code='SM')
   or not exists(select 1 from app.active_assignment(ids[2]) x join positions p on p.id=x.position_id where p.code='DIR') then raise exception 'Urutan tagihan: Senior Manager lalu Direktur.'; end if;
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
 insert into letter_versions(letter_id,version_no,version_kind,storage_path,file_format,file_hash,content_html,content_format,created_by,is_current,original_name)
 values(l.id,no,'DRAFT',p_document->>'path',p_document->>'format',p_document->>'hash',p_data->>'content',coalesce(p_data->>'contentFormat','TEXT'),p_actor,true,p_document->>'name') returning id into v;
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


revoke all on function save_letter_draft_core(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function save_letter_draft_core(uuid,jsonb,jsonb) to service_role;

