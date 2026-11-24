begin;
do $$
declare sender uuid:='a0000000-0000-0000-0000-000000000005';recipient uuid:='a0000000-0000-0000-0000-000000000006';l uuid;d uuid;a uuid; j jsonb;
begin
 l:=test_support.draft(sender);
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,reason,metadata,occurred_at) values(sender,l,'DRAFT_SAVED','letters',l::text,'RAHASIA',jsonb_build_object('private','RAHASIA'),clock_timestamp()+interval '1 second') returning id into a;
 perform set_config('request.jwt.claim.sub',sender::text,true);
 j:=get_dashboard_letter_activity();assert jsonb_array_length(j)>0 and j::text like '%'||a::text||'%';assert j::text not like '%RAHASIA%';assert jsonb_array_length(j)<=5;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 assert get_dashboard_letter_activity()::text not like '%'||l::text||'%','Penerima belum dikirim tidak boleh melihat aktivitas surat';
 d:=test_support.disposition_origin(sender,recipient);select letter_id into l from internal_dispatches where id=d;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,occurred_at) select sender,l,'DRAFT_SAVED','letters',l::text,sent_at-interval '1 second' from internal_dispatches where id=d returning id into a;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 j:=get_dashboard_letter_activity();assert j::text like '%'||l::text||'%','Penerima sah harus melihat pengiriman';assert j::text not like '%'||a::text||'%','Riwayat draf tetap privat';
 perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
 assert get_dashboard_letter_activity()::text not like '%'||l::text||'%','Admin tidak otomatis memiliki akses isi surat';
 perform set_config('request.jwt.claim.sub',sender::text,true);
 perform set_config('test.activity.sender',sender::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean:=false;begin
 assert jsonb_array_length(get_dashboard_letter_activity())>0,'Staff dapat membaca ringkasan';
 begin assert (select count(*) from audit_logs)=0,'Audit lengkap tetap admin-only';exception when insufficient_privilege then denied:=true;end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.get_dashboard_letter_activity()','execute');
 assert not (select prosecdef from pg_proc where oid='public.get_dashboard_letter_activity()'::regprocedure);
 perform set_config('request.jwt.claim.sub','',true);assert get_dashboard_letter_activity()='[]'::jsonb;
end $$;
rollback;
