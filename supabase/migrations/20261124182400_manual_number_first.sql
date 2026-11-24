-- Owner-approved manual path: reserve a real number first, then upload and retain normal approval/finality gates.
-- No backfill, fabricated document, approval, signature, or receipt. Existing numbering remains unchanged.
begin;
create table public.manual_number_reservations(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles(id),
 creator_unit_id uuid not null references organizational_units(id),letter_type_id uuid not null references letter_types(id),
 series_id uuid not null references number_series(id),reserved_signer_id uuid references profiles(id),reserved_position_id uuid references positions(id),
 subject text not null check(length(trim(subject)) between 1 and 500),official_number text not null unique,
 year integer not null,sequence_number integer not null,pattern_snapshot text not null,
 request_key uuid not null,status text not null default 'RESERVED' check(status in('RESERVED','BOUND','COMPLETED','CANCELLED')),
 letter_id uuid unique references letters(id),uploaded_version_id uuid references letter_versions(id),uploaded_hash text,
 confirmed_at timestamptz,created_at timestamptz not null default now(),unique(owner_id,request_key),unique(series_id,year,sequence_number)
);
alter table manual_number_reservations enable row level security;
revoke all on manual_number_reservations from public,anon,authenticated;
grant select on manual_number_reservations to authenticated;
grant all on manual_number_reservations to service_role;
create policy manual_number_owner on manual_number_reservations for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from profiles p where p.id=(select auth.uid()) and p.is_active));
alter table letters add column manual_number_reservation_id uuid unique references manual_number_reservations(id);
create function app.guard_manual_number_link() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.manual_number_reservation_id is distinct from old.manual_number_reservation_id then
  if current_user in('anon','authenticated') or old.manual_number_reservation_id is not null then raise exception 'Hubungan nomor hanya dapat ditetapkan melalui alur resmi.' using errcode='42501';end if;
 end if;return new;
end $$;
create trigger letters_manual_number_link before update on letters for each row execute function app.guard_manual_number_link();
revoke all on function app.guard_manual_number_link() from public,anon,authenticated;

create function reserve_manual_letter_number(p_actor uuid,p_type text,p_subject text,p_signer uuid,p_key uuid) returns manual_number_reservations
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a user_assignments;t letter_types;s number_series;r manual_number_reservations;pos uuid;yr integer;seq integer;floor_value integer;unit_code text;pos_code text;v_now timestamptz:=now();number text;
begin
 a:=app.active_assignment(p_actor);if a.id is null then raise exception 'Akun tidak memiliki penugasan aktif.';end if;
 if p_key is null or nullif(trim(p_subject),'') is null or length(trim(p_subject))>500 then raise exception 'Jenis dan perihal surat wajib diisi.';end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-number:'||p_actor::text||p_key::text,0));
 select * into t from letter_types where code=p_type and is_active;if t.id is null then raise exception 'Jenis surat tidak tersedia.';end if;
 select * into r from manual_number_reservations where owner_id=p_actor and request_key=p_key;
 if r.id is not null then
  if r.letter_type_id<>t.id or r.subject<>trim(p_subject) or r.reserved_signer_id is distinct from p_signer then raise exception 'Permintaan sudah tercatat. Buka nomor yang sudah diambil.';end if;
  return r;
 end if;
 if t.category='BILLING' and t.creator_unit_id is distinct from a.unit_id then raise exception 'Surat penagihan khusus unit Finance.';end if;
 if t.series_basis='SIGNER_POSITION' then
  if p_signer is null or not app.valid_signer(p_signer) then raise exception 'Pilih penandatangan untuk menentukan seri nomor.';end if;
  pos:=(app.active_assignment(p_signer)).position_id;
 elsif p_signer is not null then raise exception 'Penandatangan seri tidak diperlukan untuk jenis ini.';
 end if;
 select * into s from number_series where letter_type_id=t.id and status='ACTIVE' and ((t.series_basis='SIGNER_POSITION' and position_id=pos) or (t.series_basis='CREATOR_UNIT' and unit_id=a.unit_id)) order by id limit 1;
 if s.id is null then raise exception 'Seri nomor belum tersedia untuk akun ini.';end if;
 yr:=extract(year from v_now at time zone 'Asia/Jakarta');
 select coalesce(max((regexp_match(l.official_number,'^([0-9]{3,})[0-9]{2}[-/]'))[1]::integer),0) into floor_value from letters l where l.letter_type_id=t.id and right(l.official_number,4)=yr::text and ((t.series_basis='CREATOR_UNIT' and l.creator_unit_id=a.unit_id) or (t.series_basis='SIGNER_POSITION' and (app.active_assignment(l.signer_id)).position_id=pos));
 insert into number_counters(series_id,year,last_value) values(s.id,yr,floor_value) on conflict(series_id,year) do update set last_value=greatest(number_counters.last_value,excluded.last_value);
 update number_counters set last_value=last_value+1 where series_id=s.id and year=yr returning last_value into seq;
 select code into unit_code from organizational_units where id=a.unit_id;select code into pos_code from positions where id=pos;
 number:=build_official_number(s.pattern,seq,v_now,unit_code,pos_code,t.code);
 if exists(select 1 from letters where official_number=number) or exists(select 1 from number_issuances where official_number=number) then raise exception 'Nomor sudah tercatat. Hubungi pengelola seri.';end if;
 insert into manual_number_reservations(owner_id,creator_unit_id,letter_type_id,series_id,reserved_signer_id,reserved_position_id,subject,official_number,year,sequence_number,pattern_snapshot,request_key)
 values(p_actor,a.unit_id,t.id,s.id,p_signer,pos,trim(p_subject),number,yr,seq,jsonb_build_object('pattern',s.pattern,'unit',unit_code,'position',pos_code,'type',t.code)::text,p_key) returning * into r;
 insert into audit_logs(actor_id,action,entity_type,entity_id,official_number,metadata) values(p_actor,'MANUAL_NUMBER_RESERVED','manual_number_reservations',r.id::text,number,jsonb_build_object('series_id',s.id,'year',yr,'sequence_number',seq));
 return r;
end $$;

create function save_manual_numbered_draft(p_actor uuid,p_reservation uuid,p_data jsonb,p_document jsonb,p_confirmed boolean) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r manual_number_reservations;a user_assignments;t letter_types;lid uuid;v letter_versions;first_signer uuid;
begin
 select * into r from manual_number_reservations where id=p_reservation for update;
 a:=app.active_assignment(p_actor);
 if r.id is null or r.owner_id<>p_actor or a.id is null or r.status not in('RESERVED','BOUND') then raise exception 'Nomor tidak tersedia untuk akun ini.';end if;
 if r.creator_unit_id<>a.unit_id then raise exception 'Penugasan unit berubah. Hubungi pengelola nomor.';end if;
 if p_confirmed is distinct from true then raise exception 'Konfirmasi bahwa nomor sudah dicantumkan pada dokumen.';end if;
 select * into t from letter_types where id=r.letter_type_id;
 if p_data->>'source'<>'UPLOAD' or p_data->>'letterTypeCode'<>t.code then raise exception 'Jenis dan sumber surat harus sesuai nomor yang diambil.';end if;
 if r.letter_id is not null and nullif(p_data->>'id','')::uuid is distinct from r.letter_id then raise exception 'Nomor sudah terhubung ke surat. Buka surat tersebut.';end if;
 if r.letter_id is null and nullif(p_data->>'id','') is not null then raise exception 'Gunakan unggahan baru untuk nomor ini.';end if;
 if r.reserved_position_id is not null then
  first_signer:=nullif(p_data->'signerIds'->>0,'')::uuid;
  if (app.active_assignment(first_signer)).position_id is distinct from r.reserved_position_id then raise exception 'Jabatan penandatangan harus sesuai seri nomor yang diambil.';end if;
 end if;
 lid:=save_letter_draft(p_actor,p_data,p_document);
 select v0.* into v from letters l join letter_versions v0 on v0.id=l.current_version_id where l.id=lid;
 if v.id is null or nullif(v.file_hash,'') is null then raise exception 'Dokumen unggahan belum tersimpan.';end if;
 update letters set manual_number_reservation_id=r.id where id=lid;
 update manual_number_reservations set letter_id=lid,uploaded_version_id=v.id,uploaded_hash=v.file_hash,confirmed_at=now(),status='BOUND' where id=r.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,official_number,metadata) values(p_actor,lid,'MANUAL_NUMBER_UPLOAD_CONFIRMED','manual_number_reservations',r.id::text,v.id,r.official_number,jsonb_build_object('file_hash',v.file_hash,'confirmation','USER_CONFIRMED_NUMBER_IN_DOCUMENT'));
 return lid;
end $$;

create function activate_manual_letter_number(p_letter_id uuid,p_actor uuid) returns number_issuances
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r manual_number_reservations;l letters;v letter_versions;iss number_issuances;i integer;
begin
 select * into r from manual_number_reservations where letter_id=p_letter_id for update;
 select * into l from letters where id=p_letter_id for update;
 if r.id is null or r.owner_id<>p_actor or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null then raise exception 'Hanya pembuat aktif dapat melanjutkan nomor ini.';end if;
 if l.official_number is not null then select * into iss from number_issuances where letter_id=l.id;if iss.id is null or iss.status='CANCELLED' then raise exception 'Penerbitan perlu ditinjau pengelola.';end if;return iss;end if;
 select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
 if r.status<>'BOUND' or r.confirmed_at is null or r.uploaded_version_id is distinct from v.id or r.uploaded_hash is distinct from v.file_hash then raise exception 'Konfirmasi ulang versi dokumen yang sudah diberi nomor.';end if;
 if (app.active_assignment(p_actor)).unit_id is distinct from r.creator_unit_id then raise exception 'Penugasan unit berubah. Hubungi pengelola nomor.';end if;
 if r.reserved_position_id is not null and (app.active_assignment(l.signer_ids[1])).position_id is distinct from r.reserved_position_id then raise exception 'Jabatan penandatangan berubah dari seri nomor yang diambil.';end if;
 if l.status<>'READY_TO_ISSUE' or not app.approvals_complete(l.id) or cardinality(l.signer_ids)<>l.required_signature_count or exists(select 1 from unnest(l.signer_ids) x where not app.valid_signer(x)) then raise exception 'Persetujuan surat belum selesai.';end if;
 if l.review_status not in('NOT_REQUIRED','PASSED') or (l.review_status='PASSED' and not app.review_passed(l.id)) then raise exception 'Pemeriksaan belum selesai.';end if;
 insert into number_issuances(letter_id,series_id,year,sequence_number,official_number,pattern_snapshot,status,idempotency_key,issued_by,issued_at,verified_at)
 values(l.id,r.series_id,r.year,r.sequence_number,r.official_number,r.pattern_snapshot,'ISSUED','manual-reservation-'||r.id::text,p_actor,r.created_at,now()) returning * into iss;
 update letters set status='NUMBERED',official_number=r.official_number,issued_at=r.created_at,signature_status=case when l.required_signature_count=0 then 'NOT_REQUIRED' when l.signature_mode='EXTERNAL' then 'EXTERNAL' else 'WAITING' end,updated_at=now() where id=l.id;
 if l.signature_mode='IN_APP' then
  for i in 1..cardinality(l.signer_ids) loop insert into signature_requests(letter_id,numbered_version_id,signer_id,sign_order,signer_role,status) values(l.id,l.current_version_id,l.signer_ids[i],i,(select p.name from app.active_assignment(l.signer_ids[i]) a join positions p on p.id=a.position_id),case when i=1 then 'PENDING' else 'WAITING' end);end loop;
 end if;
 update manual_number_reservations set status='COMPLETED' where id=r.id;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,official_number,version_id,metadata) values(p_actor,l.id,'MANUAL_NUMBER_ACTIVATED','letters',l.id::text,r.official_number,l.current_version_id,jsonb_build_object('reservation_id',r.id,'no_counter_increment',true));
 return iss;
end $$;
revoke all on function reserve_manual_letter_number(uuid,text,text,uuid,uuid),save_manual_numbered_draft(uuid,uuid,jsonb,jsonb,boolean),activate_manual_letter_number(uuid,uuid) from public,anon,authenticated;
grant execute on function reserve_manual_letter_number(uuid,text,text,uuid,uuid),save_manual_numbered_draft(uuid,uuid,jsonb,jsonb,boolean),activate_manual_letter_number(uuid,uuid) to service_role;
-- A reserved number can only enter issuances for its bound letter. Other numbering paths cannot take it.
create function app.guard_reserved_number_issuance() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare r manual_number_reservations;linked uuid;
begin
 select * into r from manual_number_reservations where official_number=new.official_number;
 select manual_number_reservation_id into linked from letters where id=new.letter_id;
 if (r.id is not null and r.letter_id is distinct from new.letter_id) or (linked is not null and linked is distinct from r.id) then raise exception 'Nomor sudah dicadangkan untuk surat lain. Gunakan alur nomor yang telah diambil.';end if;
 return new;
end $$;
create trigger number_issuances_reserved_guard before insert on number_issuances for each row execute function app.guard_reserved_number_issuance();
revoke all on function app.guard_reserved_number_issuance() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
