begin;
create function public.read_number_register(
 p_search text default '', p_type text default '', p_year integer default null,
 p_month integer default null, p_status text default '', p_offset integer default 0,
 p_limit integer default 50
) returns table (
 issuance_id uuid, sequence_number integer, official_number text, letter_date date,
 type_name text, unit_name text, sender_name text, recipient_name text,
 subject text, month integer, year integer, number_status text
)
language sql stable security invoker set search_path=public,pg_temp as $$
 select n.id,n.sequence_number,n.official_number,l.letter_date,t.name,u.name,s.full_name,
        coalesce(r.full_name,nullif(concat_ws(' / ',l.recipient_external_name,l.recipient_external_org),'')),
        l.subject,extract(month from n.issued_at at time zone 'Asia/Jakarta')::integer,n.year,n.status
 from number_issuances n
 join letters l on l.id=n.letter_id
 join letter_types t on t.id=l.letter_type_id
 left join organizational_units u on u.id=l.creator_unit_id
 left join profiles s on s.id=coalesce(l.official_sender_id,l.creator_id)
 left join profiles r on r.id=l.recipient_user_id
 where n.official_number is not null
   and app.can_read_letter(l.id)
   and (p_type='' or t.code=p_type)
   and (p_status='' or n.status=p_status)
   and (p_year is null or n.year=p_year)
   and (p_month is null or extract(month from n.issued_at at time zone 'Asia/Jakarta')=p_month)
   and (p_search='' or strpos(lower(concat_ws(' ',n.official_number,l.subject,u.name,s.full_name,r.full_name,l.recipient_external_name,l.recipient_external_org)),lower(left(p_search,150)))>0)
 order by n.issued_at desc nulls last,n.id
 offset greatest(p_offset,0) limit least(greatest(p_limit,1),500)
$$;
grant select on public.number_issuances to authenticated;
revoke all on function public.read_number_register(text,text,integer,integer,text,integer,integer) from public,anon;
grant execute on function public.read_number_register(text,text,integer,integer,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
