begin;
create function public.finalize_letter_with_pdf(
 p_actor uuid,p_letter uuid,p_revision integer,p_source uuid,p_pdf jsonb
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare l letters; source letter_versions; pdf_id uuid; version_number integer;
begin
 select * into l from letters where id=p_letter for update;
 if l.id is null or l.creator_id<>p_actor or l.official_sender_id is null
    or (app.active_assignment(p_actor)).id is null
 then raise exception 'Akun tidak berwenang memfinalisasi PDF surat ini.';end if;
 if l.finalized_at is not null then return;end if;
 if l.status<>'NUMBERED' or l.revision is distinct from p_revision or l.current_version_id is distinct from p_source then
  raise exception 'Versi surat berubah. Pratinjau ulang sebelum finalisasi.';
 end if;
 select * into source from letter_versions v where v.id=p_source and v.letter_id=l.id;
 if source.id is null or source.version_kind not in ('NUMBERED','SIGNED') or source.file_hash is null
 then raise exception 'Versi bernomor atau bertanda tangan belum tersimpan.';end if;
 if source.file_format='PDF' then
  perform finalize_letter(p_actor,p_letter,p_revision,false);
  return;
 end if;
 if p_pdf->>'format' is distinct from 'PDF' or coalesce(p_pdf->>'hash','') !~ '^[0-9a-f]{64}$'
    or split_part(coalesce(p_pdf->>'path',''),'/',1)<>p_actor::text
    or not exists(select 1 from storage.objects where bucket_id='letter-documents' and name=p_pdf->>'path')
 then raise exception 'Berkas PDF final belum tersimpan.';end if;
 select coalesce(max(version_no),0)+1 into version_number from letter_versions where letter_id=l.id;
 update letter_versions set is_current=false where id=source.id;
 insert into letter_versions(letter_id,version_no,version_kind,storage_path,file_format,file_hash,created_by,is_current)
 values(l.id,version_number,source.version_kind,p_pdf->>'path','PDF',p_pdf->>'hash',p_actor,true)
 returning id into pdf_id;
 update letters set current_version_id=pdf_id where id=l.id;
 perform finalize_letter(p_actor,p_letter,p_revision,false);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
 values(p_actor,l.id,'FINAL_PDF_STORED','letters',l.id::text,pdf_id,jsonb_build_object('source_version',source.id,'source_hash',source.file_hash,'pdf_hash',p_pdf->>'hash'));
end $$;

create function app.require_r05_final_pdf() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if old.finalized_at is null and new.finalized_at is not null and new.official_sender_id is not null
 and not exists(select 1 from letter_versions where id=new.current_version_id and letter_id=new.id and file_format='PDF')
 then raise exception 'Surat R.05 wajib memiliki PDF sebelum dikunci.';end if;
 return new;
end $$;
create trigger letters_r05_final_pdf_guard before update of finalized_at on letters
 for each row execute function app.require_r05_final_pdf();
revoke all on function app.require_r05_final_pdf() from public,anon,authenticated;
revoke all on function public.finalize_letter_with_pdf(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_letter_with_pdf(uuid,uuid,integer,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
