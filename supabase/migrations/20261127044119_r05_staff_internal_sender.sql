begin;

create or replace function app.r05_internal_senders(creator uuid, recipient uuid) returns setof uuid
language sql stable security definer set search_path=public,pg_temp as $$
 with recursive memberships as (
   select p.id, a.unit_id, a.id as assignment_id,a.supervisor_assignment_id, pos.code,
          array_position(array['STF','GM','SM','DIR'],pos.code) as rank
   from profiles p
   cross join lateral app.active_assignment(p.id) a
   join positions pos on pos.id=a.position_id and pos.is_active
   join organizational_units u on u.id=a.unit_id and u.is_active
 ), levels as (
   select c.rank as creator_rank,r.rank as recipient_rank,c.unit_id
   from memberships c join memberships r on r.id=recipient
   where c.id=creator and creator<>recipient and c.rank is not null and r.rank is not null
 ), supervisors(assignment_id,supervisor_assignment_id) as (
   select m.assignment_id,m.supervisor_assignment_id from memberships m where m.id=creator
   union
   select m.assignment_id,m.supervisor_assignment_id from memberships m join supervisors s on m.assignment_id=s.supervisor_assignment_id
 ), hierarchy(id,parent_id) as (
   select u.id,u.parent_id from organizational_units u join levels l on l.unit_id=u.id
   union
   select u.id,u.parent_id from organizational_units u join hierarchy h on h.parent_id=u.id
   where u.is_active
 )
 select creator from levels where creator_rank>=recipient_rank
 union
 select m.id from memberships m cross join levels l
 where l.creator_rank<l.recipient_rank and m.id<>recipient
 and case
   when l.creator_rank=1 then m.rank=2 or (l.recipient_rank=4 and m.rank=3)
   else m.rank=l.recipient_rank
 end
 and (exists(select 1 from hierarchy h where h.id=m.unit_id)
      or exists(select 1 from supervisors s where s.assignment_id=m.assignment_id))
$$;
notify pgrst,'reload schema';
commit;
