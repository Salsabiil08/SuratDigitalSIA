#!/usr/bin/env bash
# Hanya PostgreSQL sementara di localhost; tidak menerima DATABASE_URL/project production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PGBIN" ];then PGBIN="$(dirname "$(command -v initdb)")";fi
D="$(mktemp -d)"; PORT=54369
cleanup(){ "$PGBIN/pg_ctl" -D "$D/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$D/data" -A trust -U postgres >/dev/null
cat >> "$D/data/postgresql.conf" <<'CONF'
unix_socket_directories = ''
listen_addresses = '127.0.0.1'
CONF
"$PGBIN/pg_ctl" -D "$D/data" -o "-p $PORT" -l "$D/log" -w start >/dev/null
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
for f in 00_stub_supabase.sql 00_stub_storage.sql;do "${PSQL[@]}" -f "$ROOT/supabase/tests/$f";done
for f in "$ROOT"/supabase/migrations/*.sql;do [[ "$(basename "$f")" > 20261118020743_rich_text_content.sql ]] && break;"${PSQL[@]}" -f "$f";done
"${PSQL[@]}" -At -f "$ROOT/scripts/readiness/catalog.sql" > "$ROOT/test-results/baseline-local.json"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/scripts/readiness/forward-fixture.sql"
node "$ROOT/scripts/readiness/prepare-forward.mjs" "$ROOT/test-results/forward.sql"
node --input-type=module -e "import fs from 'node:fs';const p=process.argv[1];fs.writeFileSync(p+'.fault.sql',fs.readFileSync(p,'utf8').replace(/commit;\\s*$/, 'select 1/0;\\ncommit;'));" "$ROOT/test-results/forward.sql"
if "${PSQL[@]}" -f "$ROOT/test-results/forward.sql.fault.sql" > "$ROOT/test-results/forward-fault.log" 2>&1;then echo 'GAGAL: fault injection tidak gagal';exit 1;fi
"${PSQL[@]}" <<'ROLLBACKCHECK'
do $$ begin assert (select count(*)=8 from supabase_migrations.schema_migrations);assert to_regclass('public.internal_dispatches') is null;assert(select count(*)=13 from letters where current_version_id is null);end $$;
ROLLBACKCHECK
node --input-type=module -e "import fs from 'node:fs';const p=process.argv[1];fs.writeFileSync(p+'.tamper.sql',fs.readFileSync(p,'utf8').replace('-- PR08_INTEGRITY_CHECK','update number_counters set last_value=0;'));" "$ROOT/test-results/forward.sql"
if "${PSQL[@]}" -f "$ROOT/test-results/forward.sql.tamper.sql" > "$ROOT/test-results/forward-tamper.log" 2>&1;then echo 'GAGAL: perubahan counter tidak ditolak';exit 1;fi
"${PSQL[@]}" -f "$ROOT/test-results/forward.sql"
"${PSQL[@]}" -f "$ROOT/scripts/readiness/assert-forward.sql"
"${PSQL[@]}" -At -f "$ROOT/scripts/readiness/catalog.sql" > "$ROOT/test-results/forward-catalog.json"
# Kedua kali harus ditolak, bukan replay/repair history.
if "${PSQL[@]}" -f "$ROOT/test-results/forward.sql" > "$ROOT/test-results/forward-retry.log" 2>&1;then echo 'GAGAL: replay diterima';exit 1;fi
echo 'FORWARD PASS: 8 migrasi, 13 surat historis/counter/audit tetap; replay ditolak'
