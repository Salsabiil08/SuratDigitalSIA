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
