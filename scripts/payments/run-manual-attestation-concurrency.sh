#!/usr/bin/env bash
# Isolated two-session proof. Not part of pgTAP. Drops its database on exit.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
db_name="a4_manual_attestation_cas"
container="${SUPABASE_DB_CONTAINER:-supabase_db_cetech-pwa-pos}"
psql=(docker exec -i "$container" psql -U supabase_admin -v ON_ERROR_STOP=1)

cleanup() {
  docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${db_name};" >/dev/null
}
trap cleanup EXIT

docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${db_name};" >/dev/null
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${db_name};" >/dev/null

while IFS= read -r migration; do
  "${psql[@]}" -d "$db_name" -q <"$migration"
done < <(find "$root/supabase/migrations" -maxdepth 1 -name '*.sql' | sort)

"${psql[@]}" -d "$db_name" -q <"$root/supabase/seed.sql"
"${psql[@]}" -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS dblink;" >/dev/null
"${psql[@]}" -d "$db_name" <"$root/scripts/payments/manual_attestation_concurrency.sql"
