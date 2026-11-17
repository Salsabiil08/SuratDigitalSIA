#!/usr/bin/env bash
# Menjalankan migrasi dan uji database pada PostgreSQL sementara (butuh PostgreSQL 15+ terpasang).
# Pemakaian: scripts/test-db.sh   (bila root, klaster dijalankan sebagai pengguna "postgres")
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$PGBIN" ] || PGBIN="$(dirname "$(command -v postgres)")"
DIR="$(mktemp -d)"; PORT="${PGPORT:-54329}"
RUN=""; if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; RUN="su postgres -c"; fi
run() { if [ -n "$RUN" ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $DIR/data stop -m immediate >/dev/null 2>&1" || true; rm -rf "$DIR"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "create database siadocs_test" >/dev/null
export PGOPTIONS='--client-min-messages=notice'
$PSQL -d siadocs_test -f "$ROOT/supabase/tests/00_stub_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrasi: $(basename "$f")"; $PSQL -d siadocs_test -f "$f"; done
$PSQL -d siadocs_test -f "$ROOT/supabase/seed.sql"
$PSQL -d siadocs_test -f "$ROOT/supabase/tests/01_numbering_test.sql"
$PSQL -d siadocs_test -f "$ROOT/supabase/tests/02_rls_test.sql"
bash "$ROOT/scripts/test-db-concurrency.sh" "$DIR" "$PORT"
echo "UJI DATABASE LULUS"
