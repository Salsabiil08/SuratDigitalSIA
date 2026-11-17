#!/usr/bin/env bash
# Uji konkurensi: 40 permintaan serentak pada 40 surat berbeda satu seri harus menghasilkan nomor urut 1..40 tanpa celah atau ganda.
set -euo pipefail
DIR="$1"; PORT="$2"
PSQL="psql -h $DIR -p $PORT -U postgres -d siadocs_test -v ON_ERROR_STOP=1 -q -At"
$PSQL <<'SQL'
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000aa','c@x') on conflict do nothing;
insert into profiles (id, full_name, email, system_role, is_active) values ('00000000-0000-0000-0000-0000000000aa','C','c@x','USER',true) on conflict do nothing;
update number_series set status = 'ACTIVE' where pattern like '%-{JENIS}/%';
insert into letters (id, letter_type_id, creation_method, status, subject, creator_id, creator_unit_id, recipient_type)
  select ('00000000-0000-0000-0000-0000000001' || lpad(g::text,2,'0'))::uuid, (select id from letter_types where code='IN'), 'EDITOR','READY_TO_ISSUE','K'||g,
         '00000000-0000-0000-0000-0000000000aa', (select id from organizational_units where code='RPT'), 'INTERNAL_USER' from generate_series(1,40) g;
SQL
$PSQL -c "update number_series set unit_id = (select id from organizational_units where code='RPT') where pattern like '%-{JENIS}/%'"
seq 1 40 | xargs -P 20 -I{} $PSQL -c "select issue_letter_number(('00000000-0000-0000-0000-0000000001' || lpad('{}',2,'0'))::uuid, '00000000-0000-0000-0000-0000000000aa', 'conc-{}')" >/dev/null
# panggilan ulang serentak pada surat yang sama tidak boleh menambah nomor
seq 1 10 | xargs -P 10 -I{} $PSQL -c "select issue_letter_number('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000aa', 'retry-{}')" >/dev/null
RES=$($PSQL -c "select count(*), count(distinct sequence_number), min(sequence_number), max(sequence_number) from number_issuances where idempotency_key like 'conc-%'")
echo "konkurensi: $RES"
[ "$RES" = "40|40|1|40" ] || { echo "GAGAL: nomor ganda atau bercelah"; exit 1; }
LAST=$($PSQL -c "select last_value from number_counters c join number_series s on s.id=c.series_id where s.pattern like '%-{JENIS}/%'")
[ "$LAST" = "40" ] || { echo "GAGAL: counter $LAST"; exit 1; }
