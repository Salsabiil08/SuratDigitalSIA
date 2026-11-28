begin;
create function public.read_admin_number_history(
 p_actor uuid, p_search text, p_type text, p_year integer, p_month integer,
 p_status text, p_offset integer, p_limit integer
) returns table (
 issuance_id uuid, sequence_number integer, official_number text, letter_date date,
 type_name text, unit_name text, month integer, year integer, number_status text
)
language sql stable security invoker set search_path=public,pg_temp as $$
 select n.id,n.sequence_number,n.official_number,l.letter_date,t.name,u.name,
   extract(month from n.issued_at at time zone 'Asia/Jakarta')::integer,n.year,n.status
 from number_issuances n
 join letters l on l.id=n.letter_id
 join letter_types t on t.id=l.letter_type_id
 left join organizational_units u on u.id=l.creator_unit_id
 where exists(select 1 from profiles p where p.id=p_actor and p.is_active and p.system_role='SUPER_ADMIN')
   and n.official_number is not null
   and (p_type='' or t.code=p_type)
   and (p_status='' or n.status=p_status)
   and (p_year is null or n.year=p_year)
   and (p_month is null or extract(month from n.issued_at at time zone 'Asia/Jakarta')=p_month)
   and (p_search='' or strpos(lower(concat_ws(' ',n.official_number,u.name)),lower(left(p_search,150)))>0)
 order by n.issued_at desc nulls last,n.id
 offset greatest(p_offset,0) limit least(greatest(p_limit,1),500)
$$;
revoke all on function public.read_admin_number_history(uuid,text,text,integer,integer,text,integer,integer) from public,anon,authenticated;
grant execute on function public.read_admin_number_history(uuid,text,text,integer,integer,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
