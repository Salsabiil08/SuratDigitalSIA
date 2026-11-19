-- PR-06. Relasi permanen; tidak menambahkan hak baca atau balasan historis.
begin;
-- Kategori adalah master bersama, tetap melalui policy baca master yang sudah ada.
grant select on document_categories to authenticated;
create table official_reply_links(
 id uuid primary key default gen_random_uuid(),
 origin_dispatch_id uuid not null references internal_dispatches(id),
 origin_letter_id uuid not null references letters(id),
 recipient_id uuid not null references profiles(id),
 reply_letter_id uuid not null unique references letters(id),
 created_by uuid not null references profiles(id),created_at timestamptz not null default now(),
 idempotency_key uuid not null,
 foreign key(origin_dispatch_id,recipient_id) references dispatch_recipients(dispatch_id,profile_id),
 unique(created_by,idempotency_key),check(origin_letter_id<>reply_letter_id),check(created_by=recipient_id));
create index official_reply_origin on official_reply_links(origin_letter_id,recipient_id,created_at);
create index official_reply_recipient_status on official_reply_links(origin_dispatch_id,recipient_id);
create table official_reply_sends(
 relation_id uuid primary key references official_reply_links(id),
 reply_dispatch_id uuid not null unique references internal_dispatches(id),
 sender_id uuid not null references profiles(id),sent_at timestamptz not null);
alter table official_reply_links enable row level security;
alter table official_reply_sends enable row level security;
create policy official_reply_links_read on official_reply_links for select to authenticated using(
 app.can_read_letter(origin_letter_id) and app.can_read_letter(reply_letter_id));
create policy official_reply_sends_read on official_reply_sends for select to authenticated using(
 exists(select 1 from official_reply_links r where r.id=relation_id));
revoke all on official_reply_links,official_reply_sends from public,anon,authenticated;
grant select on official_reply_links,official_reply_sends to authenticated;
grant all on official_reply_links,official_reply_sends to service_role;

create function app.validate_official_reply_link() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare d internal_dispatches;l letters;
begin
 if tg_op<>'INSERT' then raise exception 'Hubungan surat resmi tidak dapat diubah atau dihapus.';end if;
 select * into d from internal_dispatches where id=new.origin_dispatch_id;
 select * into l from letters where id=new.reply_letter_id;
 if d.letter_id is distinct from new.origin_letter_id or new.recipient_id is distinct from new.created_by
 or not exists(select 1 from dispatch_recipients where dispatch_id=d.id and profile_id=new.created_by and recipient_role='PRIMARY')
 or not app.can_read_letter_for(new.created_by,d.letter_id) or (app.active_assignment(new.created_by)).id is null
 or not exists(select 1 from letters where id=d.letter_id and status='NUMBERED')
 or l.creator_id is distinct from new.created_by or l.recipient_user_id is distinct from d.sender_id
 or l.status is distinct from 'DRAFT' or l.official_number is not null or l.finalized_at is not null
 or not exists(select 1 from letter_types where id=l.letter_type_id and category='INTERNAL')
 then raise exception 'Hubungan balasan hanya dari penerima utama sah ke pengirim surat asal.' using errcode='42501';end if;
 return new;
end $$;
create trigger official_reply_link_guard before insert or update or delete on official_reply_links for each row execute function app.validate_official_reply_link();
create trigger official_reply_send_immutable before update or delete on official_reply_sends for each row execute function app.freeze_dispatch_snapshot();

-- Penerima referensi dikunci; kategori/isi/lampiran dan keputusan tetap alur biasa.
create function app.guard_official_reply_letter() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if exists(select 1 from official_reply_links r join internal_dispatches d on d.id=r.origin_dispatch_id where r.reply_letter_id=old.id
 and (new.creator_id is distinct from r.created_by or new.recipient_user_id is distinct from d.sender_id or new.letter_type_id is distinct from old.letter_type_id))
 then raise exception 'Identitas pembuat, jenis dan penerima balasan resmi harus sesuai surat asal.';end if;
 return new;
end $$;
create trigger official_reply_letter_guard before update on letters for each row execute function app.guard_official_reply_letter();

alter function save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_pre_reply;
create function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare d internal_dispatches;existing official_reply_links;v_id uuid;k uuid;origin uuid;
begin
 origin:=nullif(p_data->>'replyToDispatchId','')::uuid;
 if origin is null then return save_letter_draft_pre_reply(p_actor,p_data,p_document);end if;
 if nullif(p_data->>'id','') is not null or nullif(p_data->>'dispositionId','') is not null then raise exception 'Buat balasan sebagai draf baru tanpa hubungan disposisi.';end if;
 k:=nullif(p_data->>'replyKey','')::uuid;
 if k is null then raise exception 'Kunci pembuatan balasan wajib diisi.';end if;
 select * into d from internal_dispatches where id=origin;
 perform 1 from dispatch_recipients where dispatch_id=origin and profile_id=p_actor and recipient_role='PRIMARY' for update;
 if not found or not app.can_read_letter_for(p_actor,d.letter_id) or (app.active_assignment(p_actor)).id is null
 or not exists(select 1 from letters where id=d.letter_id and status='NUMBERED') then raise exception 'Balasan hanya untuk penerima utama surat yang telah dikirim.' using errcode='42501';end if;
 select * into existing from official_reply_links where created_by=p_actor and idempotency_key=k;
 if existing.id is not null then
  if existing.origin_dispatch_id<>origin then raise exception 'Kunci balasan telah dipakai untuk surat lain.';end if;
  return existing.reply_letter_id;
 end if;
 if p_data->>'letterTypeCode' is distinct from 'IN' or (p_data->>'recipientUserId')::uuid is distinct from d.sender_id then raise exception 'Balasan internal harus ditujukan kepada pengirim resmi surat asal.';end if;
 v_id:=save_letter_draft_pre_reply(p_actor,p_data,p_document);
 insert into official_reply_links(origin_dispatch_id,origin_letter_id,recipient_id,reply_letter_id,created_by,idempotency_key)
 values(d.id,d.letter_id,p_actor,v_id,p_actor,k);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,metadata)
 values(p_actor,v_id,'OFFICIAL_REPLY_CREATED','letters',v_id::text,jsonb_build_object('origin_letter_id',d.letter_id,'origin_dispatch_id',d.id));
 return v_id;
end $$;
revoke all on function save_letter_draft(uuid,jsonb,jsonb),save_letter_draft_pre_reply(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb),save_letter_draft_pre_reply(uuid,jsonb,jsonb) to service_role;

-- Trigger berada dalam transaksi kirim PR-04. Gagal audit/notifikasi/penerima => seluruhnya rollback.
create function app.record_official_reply_send() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare r official_reply_links;
begin
 select * into r from official_reply_links where reply_letter_id=new.letter_id;
 if r.id is null then return new;end if;
 if new.primary_recipient_id is distinct from (select sender_id from internal_dispatches where id=r.origin_dispatch_id)
 or not exists(select 1 from dispatch_recipients where dispatch_id=r.origin_dispatch_id and profile_id=r.recipient_id and recipient_role='PRIMARY')
 or not app.can_read_letter_for(r.recipient_id,r.origin_letter_id) then raise exception 'Penerima atau sumber balasan tidak sah.';end if;
 insert into official_reply_sends(relation_id,reply_dispatch_id,sender_id,sent_at) values(r.id,new.id,new.sender_id,new.sent_at);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,metadata)
 values(new.sender_id,r.origin_letter_id,'OFFICIAL_REPLY_SENT','official_reply_links',r.id::text,new.version_id,
 jsonb_build_object('reply_letter_id',new.letter_id,'reply_dispatch_id',new.id,'recipient_id',r.recipient_id));
 return new;
end $$;
create trigger official_reply_after_dispatch after insert on internal_dispatches for each row execute function app.record_official_reply_send();

-- Hanya status penerima yang sudah berhak dilihat; tidak mengeluarkan ID/isi surat balasan privat.
create function app.official_reply_status(p_dispatch uuid,p_recipient uuid) returns timestamptz
language sql stable security definer set search_path=public,pg_temp as $$
 select min(s.sent_at) from official_reply_links r join official_reply_sends s on s.relation_id=r.id
 where r.origin_dispatch_id=p_dispatch and r.recipient_id=p_recipient
 and app.can_read_letter_for(auth.uid(),r.origin_letter_id)
 and (auth.uid()=p_recipient or app.can_view_internal_outbox(p_dispatch))
$$;
revoke all on function app.official_reply_status(uuid,uuid) from public,anon;
grant execute on function app.official_reply_status(uuid,uuid) to authenticated,service_role;

create function get_official_reply_context(p_letter uuid) returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare seed jsonb;links jsonb;statuses jsonb;
begin
 if auth.uid() is null or not app.can_read_letter(p_letter) then raise exception 'Surat tidak dapat diakses oleh akun ini.' using errcode='42501';end if;
 select jsonb_build_object('dispatchId',d.id,'senderId',d.sender_id,'officialNumber',d.official_number,'subject',l.subject,'categoryCode',c.code)
 into seed from internal_dispatches d join letters l on l.id=d.letter_id join document_categories c on c.id=l.category_id
 join dispatch_recipients r on r.dispatch_id=d.id and r.profile_id=auth.uid() and r.recipient_role='PRIMARY'
 join profiles sender on sender.id=d.sender_id and sender.is_active
 where d.letter_id=p_letter and l.status='NUMBERED';
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'direction',case when r.reply_letter_id=p_letter then 'ORIGIN' else 'REPLY' end,
 'letterId',other.id,'subject',other.subject,'officialNumber',other.official_number,'status',other.status,
 'createdAt',r.created_at,'actorId',r.created_by,'actorName',actor.full_name,'sentAt',s.sent_at) order by r.created_at),'[]') into links
 from official_reply_links r join letters other on other.id=case when r.reply_letter_id=p_letter then r.origin_letter_id else r.reply_letter_id end
 join profiles actor on actor.id=r.created_by left join official_reply_sends s on s.relation_id=r.id
 where r.origin_letter_id=p_letter or r.reply_letter_id=p_letter;
 select coalesce(jsonb_agg(jsonb_build_object('profileId',r.profile_id,'repliedAt',app.official_reply_status(r.dispatch_id,r.profile_id))),'[]') into statuses
 from dispatch_recipients r join internal_dispatches d on d.id=r.dispatch_id where d.letter_id=p_letter;
 return jsonb_build_object('seed',seed,'links',links,'recipients',statuses);
end $$;
revoke all on function get_official_reply_context(uuid) from public,anon,service_role;
grant execute on function get_official_reply_context(uuid) to authenticated;
revoke all on function app.validate_official_reply_link(),app.guard_official_reply_letter(),app.record_official_reply_send() from public,anon,authenticated;
create or replace function list_internal_mailbox(p_folder text,p_filter text default 'ALL',p_query text default '',p_page integer default 1,p_size integer default 10) returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and is_active) then raise exception 'Masuk dengan akun aktif untuk membuka kotak surat.' using errcode='42501';end if;
 if p_folder is null or p_folder not in ('INBOX','OUTBOX') or p_filter is null or p_filter not in ('ALL','UNREAD','UNRECEIVED','RECEIVED')
 or p_page is null or p_page<1 or p_page>100000 or p_size is null or p_size not in (10,20,50) or length(coalesce(p_query,''))>100 then raise exception 'Pilihan kotak surat tidak valid.';end if;
 with base as (
  select d.id as dispatch_id,d.letter_id,d.sender_id,sender.full_name as sender_name,l.subject,d.official_number,d.sent_at,l.finalized_at,l.status as letter_status,
   (select coalesce(jsonb_agg(jsonb_build_object('profile_id',r.profile_id,'name',person.full_name,'role',r.recipient_role,'read_at',r.read_at,'received_at',r.received_at,'requires_response',r.requires_response,'replied_at',app.official_reply_status(r.dispatch_id,r.profile_id))
     order by case r.recipient_role when 'PRIMARY' then 0 else 1 end,r.profile_id),'[]') from dispatch_recipients r join profiles person on person.id=r.profile_id
     where r.dispatch_id=d.id and (p_folder='OUTBOX' or r.profile_id=auth.uid())) as recipients
  from internal_dispatches d join letters l on l.id=d.letter_id join profiles sender on sender.id=d.sender_id
  where ((p_folder='INBOX' and exists(select 1 from dispatch_recipients mine where mine.dispatch_id=d.id and mine.profile_id=auth.uid()))
    or (p_folder='OUTBOX' and app.can_view_internal_outbox(d.id)))
   and (btrim(coalesce(p_query,''))='' or strpos(lower(coalesce(l.subject,'')),lower(btrim(p_query)))>0
     or strpos(lower(d.official_number),lower(btrim(p_query)))>0 or strpos(lower(coalesce(sender.full_name,'')),lower(btrim(p_query)))>0)
 ), filtered as (
  select * from base where p_filter='ALL'
   or (p_filter='UNREAD' and exists(select 1 from jsonb_array_elements(recipients) r where r->>'read_at' is null))
   or (p_filter='UNRECEIVED' and exists(select 1 from jsonb_array_elements(recipients) r where r->>'role'='PRIMARY' and r->>'received_at' is null))
   or (p_filter='RECEIVED' and exists(select 1 from jsonb_array_elements(recipients) r where r->>'role'='PRIMARY' and r->>'received_at' is not null))
 ), meta as (select count(*) as total,greatest(1,ceil(count(*)::numeric/p_size)::integer) as pages from filtered),
 paging as (select total,pages,least(p_page,pages) as page from meta),
 page_rows as (select * from filtered order by sent_at desc,dispatch_id desc limit p_size offset (select (page-1)*p_size from paging))
 select jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sent_at desc,x.dispatch_id desc),'[]') from page_rows x),
  'total',total,'page',page,'pageSize',p_size,'pages',pages) into result from paging;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
