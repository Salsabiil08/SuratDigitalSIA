-- Owner-authorized beta cleanup. Preserve numbered rows, counters and audit history.
create table app.removed_beta_letters (
 letter_id uuid primary key references public.letters(id),
 removed_at timestamptz not null default now(),
 reason text not null
);
alter table app.removed_beta_letters enable row level security;
revoke all on app.removed_beta_letters from public,anon,authenticated;
create or replace function app.can_read_letter_for(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from app.removed_beta_letters r where r.letter_id=p_letter) and (
 app.can_read_letter_for_pre_review(p_actor,p_letter)
 or exists(select 1 from letters l join review_steps s on s.letter_id=l.id and s.version_id=l.current_version_id where l.id=p_letter and l.reviewer_id=p_actor and s.reviewer_id=p_actor and s.status in ('PENDING','PASSED') and l.review_status in ('WAITING','PASSED') and app.authorized_reviewer(p_actor,l.creator_unit_id,l.letter_type_id))
 or app.is_dispatch_recipient(p_actor,p_letter)
 or exists(select 1 from letters l where l.id=p_letter and l.finalized_at is not null and l.status='NUMBERED' and app.is_dispatch_delegate(p_actor,l.creator_unit_id))
 )
$$;
-- No fake approval/cancellation is recorded. These are removed beta test records.
do $$ declare l record;begin
 for l in select * from letters where
  (id='cf87e6fb-8374-4f13-8678-f05340c81b8c' and subject='Beli semen' and official_number='01019/KRE.DIR/11.2026') or
  (id='b5b2e7cf-a4e5-4edc-82b8-c0e6badfcb96' and subject='Tes' and official_number='00617/KRE.DIR/11.2026')
 loop
  if l.finalized_at is not null or l.current_version_id is not null or exists(select 1 from internal_dispatches where letter_id=l.id) then raise exception 'Data berubah; penghapusan aman dihentikan.';end if;
  insert into app.removed_beta_letters(letter_id,reason) values(l.id,'Permintaan pemilik beta: hapus hanya Beli semen 01019/KRE.DIR/11.2026 dan Tes 00617/KRE.DIR/11.2026. Nomor tetap dicadangkan.');
  insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,official_number,reason,metadata) values(null,l.id,'BETA_TEST_LETTER_REMOVED','letters',l.id::text,l.official_number,'Penghapusan aman data percobaan atas permintaan pemilik beta.',jsonb_build_object('authorization_source','explicit_owner_request_2026_11_24','preserved_number',true));
 end loop;
end $$;
notify pgrst,'reload schema';
