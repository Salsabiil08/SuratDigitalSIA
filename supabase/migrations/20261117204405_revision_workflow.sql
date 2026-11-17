-- REV-01..07. Perubahan aditif; nomor dan dokumen lama tidak ditulis ulang.
alter table letters add column if not exists letter_date date;
alter table letters add column if not exists date_change_reason text;
alter table letters add column if not exists recipient_external_address text;
alter table letters add column if not exists signer_ids uuid[] not null default '{}';
alter table letters add column if not exists signature_areas jsonb not null default '[]';
alter table letters add column if not exists stamp_area jsonb;
alter table letters add column if not exists number_area jsonb;
alter table letters add column if not exists revision integer not null default 0;
alter table letters add column if not exists finalized_at timestamptz;
alter table letters add column if not exists finalized_by uuid references profiles(id);
alter table letters add column if not exists previewed_revision integer;
alter table signature_requests add column if not exists signature_image_path text;
alter table signature_requests add column if not exists stamp_image_path text;
alter table signature_requests add column if not exists method text;
alter table letter_versions add column if not exists original_name text;

create or replace function app.active_assignment(p_actor uuid)
returns user_assignments language sql stable security definer set search_path = public as $$
 select a from user_assignments a join profiles p on p.id=a.profile_id
 where a.profile_id=p_actor and p.is_active and a.is_active
 and (a.start_date is null or a.start_date<=current_date) and (a.end_date is null or a.end_date>=current_date)
 order by a.start_date desc nulls last limit 1
$$;
create or replace function app.valid_signer(p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from app.active_assignment(p_actor) a join positions p on p.id=a.position_id
 where a.is_official_signer and p.is_active and p.code in ('SM','DIR'))
$$;
create or replace function app.can_backdate(p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from app.active_assignment(p_actor) a join positions p on p.id=a.position_id
 where p.is_active and p.code in ('GM','SM','DIR'))
$$;

-- Hanya RPC server yang boleh mengubah alur; klien tidak dapat melompati approval/nomor.
drop policy if exists letters_insert on letters;
drop policy if exists letters_update on letters;
drop policy if exists letters_delete on letters;
drop policy if exists letter_versions_write on letter_versions;

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
   if not exists(select 1 from organizational_units where id=a.unit_id and code='FIN') or n<>2 then raise exception 'Tagihan khusus Finance dan wajib dua penandatangan.'; end if;
   if not exists(select 1 from app.active_assignment(ids[1]) x join positions p on p.id=x.position_id join organizational_units u on u.id=x.unit_id where p.code='SM' and u.code='FIN')
   or not exists(select 1 from app.active_assignment(ids[2]) x join positions p on p.id=x.position_id where p.code='DIR') then raise exception 'Urutan tagihan: SM Finance lalu Direktur.'; end if;
   b:=p_data->'billing';
   bank:=nullif(b->>'bankId','')::uuid;
   if bank is null and nullif(trim(b->>'bankName'),'') is not null then
     select id into bank from master_bank where lower(name)=lower(trim(b->>'bankName')) and is_active limit 1;
     if bank is null then insert into master_bank(name,is_active) values(trim(b->>'bankName'),true) returning id into bank; end if;
   end if;
   if b is null or jsonb_array_length(b->'items')<2 or nullif(b->>'accountNumber','') is null or nullif(b->>'accountHolder','') is null
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

create or replace function review_letter(p_actor uuid,p_letter uuid,p_action text,p_revision integer,p_note text default null)
returns text language plpgsql set search_path=public as $$
declare l letters; s approval_steps; nxt approval_steps; i integer; c integer; dest text;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or (app.active_assignment(p_actor)).id is null then raise exception 'Akun/surat tidak valid.'; end if;
 if l.finalized_at is not null or l.revision is distinct from p_revision then raise exception 'Versi surat berubah atau telah final.'; end if;
 if p_action='PREVIEW' then
   if l.creator_id<>p_actor or l.status not in ('DRAFT','REVISION_REQUESTED') then raise exception 'Preview draft hanya oleh pembuat.'; end if;
   update letters set previewed_revision=revision where id=l.id; return l.status;
 elsif p_action='SUBMIT' then
   if l.creator_id<>p_actor or l.status not in ('DRAFT','REVISION_REQUESTED') or l.current_version_id is null or l.previewed_revision is distinct from l.revision then raise exception 'Simpan dan preview draft terkini sebelum mengajukan.'; end if;
   if exists(select 1 from unnest(l.signer_ids) x where not app.valid_signer(x)) then raise exception 'Kewenangan penandatangan berubah.'; end if;
   if exists(select 1 from letter_types where id=l.letter_type_id and required_attachment) and not exists(select 1 from letter_attachments where letter_id=l.id) then raise exception 'Lampiran bukti wajib sebelum pengajuan.'; end if;
   select coalesce(max(cycle),0)+1 into c from approval_steps where letter_id=l.id;
   update approval_steps set status='SUPERSEDED' where letter_id=l.id and status in ('PENDING','WAITING');
   for i in 1..cardinality(l.signer_ids) loop
     insert into approval_steps(letter_id,cycle,step_order,approver_id,step_source,status,version_id)
     values(l.id,c,i,l.signer_ids[i],case when cardinality(l.signer_ids)=2 then case when i=1 then 'BILLING_SUBMITTER' else 'BILLING_APPROVER' end else 'SIGNER_CONFIRMATION' end,case when i=1 then 'PENDING' else 'WAITING' end,l.current_version_id);
   end loop;
   dest:=case when cardinality(l.signer_ids)=0 then 'READY_TO_ISSUE' else 'IN_REVIEW' end;
 else
   if l.status<>'IN_REVIEW' then raise exception 'Surat tidak dalam persetujuan.'; end if;
   select * into s from approval_steps where letter_id=l.id and approver_id=p_actor and status='PENDING' order by cycle desc limit 1 for update;
   if s.id is null or s.version_id is distinct from l.current_version_id or not app.valid_signer(p_actor) then raise exception 'Bukan penyetuju aktif pada versi ini.'; end if;
   if p_action not in ('APPROVE','REJECT','REQUEST_REVISION') then raise exception 'Aksi tidak valid.'; end if;
   if p_action<>'APPROVE' and nullif(trim(p_note),'') is null then raise exception 'Alasan wajib diisi.'; end if;
   update approval_steps set status=case p_action when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end,decided_at=now(),decision_note=p_note where id=s.id;
   if p_action='APPROVE' then
     select * into nxt from approval_steps where letter_id=l.id and cycle=s.cycle and step_order>s.step_order and status='WAITING' order by step_order limit 1;
     if nxt.id is not null then update approval_steps set status='PENDING' where id=nxt.id; dest:='IN_REVIEW'; else dest:='READY_TO_ISSUE'; end if;
   else
     dest:=case p_action when 'REJECT' then 'REJECTED' else 'REVISION_REQUESTED' end;
     update approval_steps set status='SUPERSEDED' where letter_id=l.id and cycle=s.cycle and status in ('PENDING','WAITING');
   end if;
 end if;
 update letters set status=dest,status_reason=p_note,updated_at=now() where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,status_before,status_after,version_id,reason)
 values(p_actor,l.id,p_action,'letters',l.id::text,l.status,dest,l.current_version_id,p_note);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,p_action,'Status surat diperbarui: '||dest,false);
 insert into notifications(recipient_id,letter_id,event_type,title,is_read)
 select approver_id,l.id,'APPROVAL_REQUEST','Surat menunggu persetujuan Anda.',false from approval_steps where letter_id=l.id and status='PENDING';
 return dest;
end $$;

-- Pertahankan counter/format/idempotensi R.04; tambahkan otorisasi, validasi approval, dan antrean TTD atomik.
alter function issue_letter_number(uuid,uuid,text) rename to issue_letter_number_core;
revoke all on function issue_letter_number_core(uuid,uuid,text) from public,anon,authenticated,service_role;
create function issue_letter_number(p_letter_id uuid,p_actor uuid,p_idempotency_key text)
returns number_issuances language plpgsql security definer set search_path=public as $$
declare l letters; iss number_issuances; i integer; series number_series; t letter_types; pos uuid; floor_value integer; yr integer;
begin
 select * into l from letters where id=p_letter_id for update;
 if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null then raise exception 'Hanya pembuat aktif dapat menerbitkan nomor.'; end if;
 if l.official_number is not null then select * into iss from number_issuances where letter_id=l.id; if iss.id is null or iss.status='CANCELLED' then raise exception 'Penerbitan lama perlu ditinjau pengelola.'; end if; return iss; end if;
 if l.current_version_id is null or l.status<>'READY_TO_ISSUE' or cardinality(l.signer_ids)<>l.required_signature_count then raise exception 'Surat belum siap diterbitkan.'; end if;
 if (select count(*) from approval_steps where letter_id=l.id and version_id=l.current_version_id and status='APPROVED')<>l.required_signature_count
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
 if p_method not in ('IMAGE','WET_UPLOAD') or nullif(p_document->>'path','') is null or nullif(p_document->>'hash','') is null then raise exception 'Berkas hasil belum tersimpan.'; end if;
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
   if l.signature_mode='EXTERNAL' and not p_external_confirmed then raise exception 'Konfirmasi pengesahan di luar sistem wajib.'; end if;
 end if;
 update letters set finalized_at=now(),finalized_by=p_actor,revision=revision+1,updated_at=now() where id=l.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata) values(p_actor,l.id,'FINALIZE','letters',l.id::text,l.current_version_id,jsonb_build_object('external_confirmation',p_external_confirmed));
end $$;

create or replace function protect_final_letter() returns trigger language plpgsql as $$
begin
 if old.finalized_at is not null and (new.subject,new.letter_date,new.recipient_user_id,new.recipient_external_name,new.recipient_external_org,new.recipient_external_address,new.current_version_id,new.signer_ids,new.signature_areas,new.stamp_area,new.number_area,new.finalized_at) is distinct from (old.subject,old.letter_date,old.recipient_user_id,old.recipient_external_name,old.recipient_external_org,old.recipient_external_address,old.current_version_id,old.signer_ids,old.signature_areas,old.stamp_area,old.number_area,old.finalized_at) then raise exception 'Dokumen final terkunci.'; end if;
 if old.official_number is not null and (new.official_number,new.issued_at) is distinct from (old.official_number,old.issued_at) then raise exception 'Nomor resmi tidak dapat diubah.'; end if;
 return new;
end $$;
create trigger protect_final_letter_trg before update on letters for each row execute function protect_final_letter();

-- Metadata versi dan aset privat mengikuti hak baca surat; gambar mentah hanya server.
-- RPC menerima actor dari Supabase Auth yang diverifikasi server, tidak dari browser.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('save_letter_draft','review_letter','issue_letter_number','record_signature','finalize_letter') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;
notify pgrst,'reload schema';

-- Publikasikan salinan bernomor yang benar-benar tersimpan, tanpa mengubah naskah persetujuan.
create function record_numbered_document(p_actor uuid,p_letter uuid,p_previous_version uuid,p_document jsonb)
returns void language plpgsql set search_path=public as $$
declare l letters; v uuid; no integer; kind text;
begin
 select * into l from letters where id=p_letter for update;
 if l.creator_id is distinct from p_actor or l.status<>'NUMBERED' or l.finalized_at is not null then raise exception 'Tidak berwenang menyimpan salinan bernomor.'; end if;
 select version_kind into kind from letter_versions where id=l.current_version_id;
 if kind in ('NUMBERED','SIGNED') then return; end if;
 if l.current_version_id is distinct from p_previous_version or nullif(p_document->>'hash','') is null then raise exception 'Versi berubah.'; end if;
 select coalesce(max(version_no),0)+1 into no from letter_versions where letter_id=l.id;
 update letter_versions set is_current=false where letter_id=l.id and is_current;
 insert into letter_versions(letter_id,version_no,version_kind,storage_path,file_format,file_hash,created_by,is_current)
 values(l.id,no,'NUMBERED',p_document->>'path',p_document->>'format',p_document->>'hash',p_actor,true) returning id into v;
 update letters set current_version_id=v,revision=revision+1 where id=l.id;
 update signature_requests set numbered_version_id=v where letter_id=l.id and status in ('PENDING','WAITING');
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,l.id,'NUMBERED_DOCUMENT_STORED','letters',l.id::text,v);
end $$;
revoke all on function record_numbered_document(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function record_numbered_document(uuid,uuid,uuid,jsonb) to service_role;

-- Bekukan versi final, termasuk ketika penulisan memakai service role.
create function protect_final_version() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from letters where id=old.letter_id and finalized_at is not null) then raise exception 'Versi dokumen final terkunci.'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_final_version_trg before update or delete on letter_versions for each row execute function protect_final_version();

-- Perbaiki search_path fungsi lama yang dipakai alur ini.
alter function issue_letter_number_core(uuid,uuid,text) set search_path=public;
alter function build_official_number(text,integer,timestamptz,text,text,text) set search_path=public;
alter function letters_guard() set search_path=public;
alter function set_updated_at() set search_path=public;
alter function audit_logs_immutable() set search_path=public;
alter function complete_number_issuance(uuid,uuid,uuid) set search_path=public;
alter function cancel_numbered_letter(uuid,uuid,text) set search_path=public;
alter function check_disposition_completion() set search_path=public;

-- Bucket privat. Tidak ada kebijakan publik untuk gambar TTD/stempel mentah.
do $$ begin
 if to_regclass('storage.buckets') is not null then
   insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   values('letter-documents','letter-documents',false,3145728,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
   ('signature-assets','signature-assets',false,524288,array['image/png'])
   on conflict(id) do nothing;
 end if;
end $$;
-- Fungsi RLS di skema app digunakan oleh query terautentikasi dan RPC server.
grant usage on schema app to authenticated,service_role;

-- Tutup grant rutin lama/default yang terlalu luas; operasi bisnis hanya server.
revoke all on function complete_number_issuance(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function cancel_numbered_letter(uuid,uuid,text) from public,anon,authenticated;
