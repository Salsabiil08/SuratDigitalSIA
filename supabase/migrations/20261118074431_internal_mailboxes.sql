-- PR-05 read-only mailbox surface. Tidak membuat pengiriman/receipt historis.
begin;
create function app.can_view_internal_outbox(p_dispatch uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from internal_dispatches d join letters l on l.id=d.letter_id
 where d.id=p_dispatch and app.can_read_letter_for(auth.uid(),l.id)
 and (d.sender_id=auth.uid() or l.creator_id=auth.uid() or app.is_dispatch_delegate(auth.uid(),l.creator_unit_id)))
$$;
revoke all on function app.can_view_internal_outbox(uuid) from public,anon;
grant execute on function app.can_view_internal_outbox(uuid) to authenticated,service_role;
-- Delegasi pengirim sah boleh melihat status seluruh penerima sesuai lingkup;
-- receiver-only tetap hanya barisnya sendiri. Tidak memperluas hak dokumen.
alter policy dispatch_recipients_read on dispatch_recipients using (
 exists(select 1 from profiles where id=auth.uid() and is_active)
 and (profile_id=auth.uid() or app.can_view_internal_outbox(dispatch_id)));

create function list_internal_mailbox(p_folder text,p_filter text default 'ALL',p_query text default '',p_page integer default 1,p_size integer default 10) returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and is_active) then raise exception 'Masuk dengan akun aktif untuk membuka kotak surat.' using errcode='42501';end if;
 if p_folder is null or p_folder not in ('INBOX','OUTBOX') or p_filter is null or p_filter not in ('ALL','UNREAD','UNRECEIVED','RECEIVED')
 or p_page is null or p_page<1 or p_page>100000 or p_size is null or p_size not in (10,20,50) or length(coalesce(p_query,''))>100 then raise exception 'Pilihan kotak surat tidak valid.';end if;
 with base as (
  select d.id as dispatch_id,d.letter_id,d.sender_id,sender.full_name as sender_name,l.subject,d.official_number,d.sent_at,l.finalized_at,l.status as letter_status,
   (select coalesce(jsonb_agg(jsonb_build_object('profile_id',r.profile_id,'name',person.full_name,'role',r.recipient_role,'read_at',r.read_at,'received_at',r.received_at,'requires_response',r.requires_response)
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
revoke all on function list_internal_mailbox(text,text,text,integer,integer) from public,anon,service_role;
grant execute on function list_internal_mailbox(text,text,text,integer,integer) to authenticated;
create index internal_dispatches_mailbox_sort on internal_dispatches(sent_at desc,id desc);
notify pgrst,'reload schema';
commit;
