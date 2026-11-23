-- Optional comment replies; no historical backfill, document/number or receipt changes.
create table public.letter_comments (
 id uuid primary key default gen_random_uuid(),
 dispatch_id uuid not null references public.internal_dispatches(id),
 author_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 5000 and body ~ '[^[:space:]]'),
 idempotency_key uuid not null,
 created_at timestamptz not null default now(),
 unique(author_id,idempotency_key)
);
create index letter_comments_thread on public.letter_comments(dispatch_id,created_at,id);
alter table public.letter_comments enable row level security;
revoke all on public.letter_comments from public,anon,authenticated;
grant select on public.letter_comments to authenticated;
grant all on public.letter_comments to service_role;

create function app.can_read_comment_thread(p_dispatch uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null
 and exists(select 1 from profiles p where p.id=auth.uid() and p.is_active)
 and exists(select 1 from internal_dispatches d where d.id=p_dispatch
  and app.can_read_letter_for(auth.uid(),d.letter_id)
  and (d.sender_id=auth.uid() or (d.primary_recipient_id=auth.uid() and exists(
   select 1 from dispatch_recipients r where r.dispatch_id=d.id and r.profile_id=auth.uid() and r.recipient_role='PRIMARY'))))
$$;
revoke all on function app.can_read_comment_thread(uuid) from public,anon;
grant execute on function app.can_read_comment_thread(uuid) to authenticated;
create policy letter_comments_read on public.letter_comments for select to authenticated using(app.can_read_comment_thread(dispatch_id));

create view public.letter_comment_summaries with(security_invoker=true) as
 select dispatch_id,author_id,max(created_at) as commented_at from public.letter_comments group by dispatch_id,author_id;
revoke all on public.letter_comment_summaries from public,anon,authenticated;
grant select on public.letter_comment_summaries to authenticated;

create function public.add_letter_comment(p_letter uuid,p_body text,p_key uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();d internal_dispatches;v uuid;old letter_comments;target uuid;
begin
 if actor is null then raise exception 'Silakan masuk terlebih dahulu.' using errcode='42501';end if;
 select * into d from internal_dispatches where letter_id=p_letter for update;
 if d.id is null or not app.can_read_comment_thread(d.id) then raise exception 'Anda tidak berwenang menanggapi surat ini.' using errcode='42501';end if;
 if not exists(select 1 from letters where id=p_letter and status='NUMBERED' and finalized_at is not null) then raise exception 'Surat ini tidak dapat menerima komentar baru.';end if;
 if p_key is null or p_body is null or char_length(p_body)>5000 or char_length(btrim(p_body))<1 or p_body !~ '[^[:space:]]' then raise exception 'Isi komentar 1 sampai 5000 karakter.';end if;
 insert into letter_comments(dispatch_id,author_id,body,idempotency_key) values(d.id,actor,btrim(p_body),p_key)
 on conflict(author_id,idempotency_key) do nothing returning id into v;
 if v is null then
  select * into old from letter_comments where author_id=actor and idempotency_key=p_key;
  if old.dispatch_id is distinct from d.id or old.body is distinct from btrim(p_body) then raise exception 'Komentar telah berubah. Muat ulang sebelum mengirim kembali.';end if;
  return old.id;
 end if;
 target:=case when actor=d.sender_id then d.primary_recipient_id else d.sender_id end;
 insert into notifications(recipient_id,letter_id,dispatch_id,event_type,title,is_read)
 values(target,d.letter_id,d.id,'LETTER_COMMENT_ADDED','Ada tanggapan baru pada surat Anda.',false);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,metadata)
 values(actor,d.letter_id,'LETTER_COMMENT_ADDED','letter_comments',v::text,jsonb_build_object('dispatch_id',d.id));
 return v;
end $$;
revoke all on function public.add_letter_comment(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.add_letter_comment(uuid,text,uuid) to authenticated;

create function public.get_letter_comment_context(p_letter uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare d internal_dispatches;items jsonb;total bigint;
begin
 if auth.uid() is null or not app.can_read_letter_for(auth.uid(),p_letter) then raise exception 'Surat tidak dapat diakses.' using errcode='42501';end if;
 select * into d from internal_dispatches where letter_id=p_letter;
 if d.id is null or not app.can_read_comment_thread(d.id) then return jsonb_build_object('canRead',false,'canComment',false,'items','[]'::jsonb,'total',0,'recipientCommented',false);end if;
 select count(*) into total from letter_comments where dispatch_id=d.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'authorId',c.author_id,'authorName',p.full_name,'body',c.body,'createdAt',c.created_at) order by c.created_at,c.id),'[]') into items
 from (select * from letter_comments where dispatch_id=d.id order by created_at desc,id desc limit 100) c join profiles p on p.id=c.author_id;
 return jsonb_build_object('canRead',true,'canComment',exists(select 1 from letters where id=p_letter and status='NUMBERED' and finalized_at is not null),
  'items',items,'total',total,'recipientCommented',exists(select 1 from letter_comments where dispatch_id=d.id and author_id=d.primary_recipient_id));
end $$;
revoke all on function public.get_letter_comment_context(uuid) from public,anon,authenticated;
grant execute on function public.get_letter_comment_context(uuid) to authenticated;
notify pgrst,'reload schema';
