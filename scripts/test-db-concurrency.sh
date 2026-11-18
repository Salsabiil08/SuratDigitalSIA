#!/usr/bin/env bash
# Fixture sah melalui draft/preview/pengajuan. Database sementara saja.
set -euo pipefail
DIR="$1"; PORT="$2"
PSQL="psql -h $DIR -p $PORT -U postgres -d siadocs_test -v ON_ERROR_STOP=1 -q -At"
$PSQL <<'SQL'
create table test_support.concurrent_letters(n integer primary key,letter_id uuid not null);
do $$
declare i integer;l uuid;a uuid:='a0000000-0000-0000-0000-000000000005';
begin
 for i in 1..40 loop
  l:=test_support.draft(a);perform test_support.submit(a,l);insert into test_support.concurrent_letters values(i,l);
 end loop;
end $$;
SQL
seq 1 40 | xargs -P 20 -I{} $PSQL -c "select issue_letter_number((select letter_id from test_support.concurrent_letters where n={}), 'a0000000-0000-0000-0000-000000000005','conc-{}')" >/dev/null
seq 1 10 | xargs -P 10 -I{} $PSQL -c "select issue_letter_number((select letter_id from test_support.concurrent_letters where n=1),'a0000000-0000-0000-0000-000000000005','retry-{}')" >/dev/null
RES=$($PSQL -c "select count(*),count(distinct sequence_number),min(sequence_number),max(sequence_number) from number_issuances where idempotency_key like 'conc-%'")
echo "konkurensi: $RES"
[ "$RES" = "40|40|1|40" ] || { echo "GAGAL: nomor ganda atau bercelah"; exit 1; }
LAST=$($PSQL -c "select last_value from number_counters where series_id=(select series_id from number_issuances where idempotency_key='conc-1')")
[ "$LAST" = "40" ] || { echo "GAGAL: counter $LAST"; exit 1; }
# Pengiriman resmi dan penerimaan: 20 permintaan bersamaan, snapshot/event tetap satu.
$PSQL <<'SQL'
create table test_support.delivery_target(letter_id uuid,version_id uuid,file_hash text);
do $$
declare l letters;
begin
 select * into l from letters where id=(select letter_id from test_support.concurrent_letters where n=1);
 perform test_support.number(l.creator_id,l.id,'materialize-existing');
 select * into l from letters where id=l.id;
 perform finalize_letter(l.creator_id,l.id,l.revision,false);
 insert into test_support.delivery_target select l.id,v.id,v.file_hash from letter_versions v where v.id=l.current_version_id;
end $$;
SQL
seq 1 20 | xargs -P 20 -I{} $PSQL -c "select dispatch_internal_letter('a0000000-0000-0000-0000-000000000005',letter_id,version_id,file_hash,'dispatch-concurrent-{}') from test_support.delivery_target" >/dev/null
seq 1 20 | xargs -P 20 -I{} $PSQL -c "select record_internal_recipient_action('a0000000-0000-0000-0000-000000000006',(select d.id from internal_dispatches d join test_support.delivery_target t on t.letter_id=d.letter_id),'READ')" >/dev/null
seq 1 20 | xargs -P 20 -I{} $PSQL -c "select record_internal_recipient_action('a0000000-0000-0000-0000-000000000006',(select d.id from internal_dispatches d join test_support.delivery_target t on t.letter_id=d.letter_id),'RECEIVE')" >/dev/null
$PSQL <<'SQL'
do $$
declare d uuid;
begin
 select x.id into d from internal_dispatches x join test_support.delivery_target t on t.letter_id=x.letter_id;
 assert(select count(*)=1 from internal_dispatches x join test_support.delivery_target t on t.letter_id=x.letter_id);
 assert(select count(*)=1 from dispatch_recipients where dispatch_id=d);
 assert(select count(*)=1 from audit_logs where entity_id=d::text and action='INTERNAL_SENT');
 assert(select count(*)=1 from audit_logs where entity_id=d::text and action='INTERNAL_READ');
 assert(select count(*)=1 from audit_logs where entity_id=d::text and action='INTERNAL_RECEIVE');
 assert(select count(*)=1 from notifications where dispatch_id=d and event_type='INTERNAL_SENT');
 assert(select count(*)=1 from notifications where dispatch_id=d and event_type='INTERNAL_RECEIVED');
end $$;
SQL
echo "PENGIRIMAN/PEMBACAAN/PENERIMAAN KONKUREN LULUS: 20 retry masing-masing, satu snapshot dan event"
