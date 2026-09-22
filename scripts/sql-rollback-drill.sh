#!/usr/bin/env bash
# sql-rollback-drill.sh — rehearse rolling back 0018+0019 on a NON-LIVE database.
#
# Usage:
#   DATABASE_URL=postgres://... bash scripts/sql-rollback-drill.sh [--force]
#
# Requirements: psql, network access to the target database.
# Safety: refuses to run against the production project ref
# (zuctxglrrijcvtcwckks) unless --force is passed. Use a staging or throwaway
# Supabase project. The target must already have 0018+0019 applied.
set -euo pipefail
cd "$(dirname "$0")/.."

LIVE_REF="zuctxglrrijcvtcwckks"
if [[ "${1:-}" != "--force" ]]; then
  if [[ "${DATABASE_URL:-}" == *"$LIVE_REF"* ]]; then
    echo "✗ refusing to run the rollback drill on the production project ($LIVE_REF)." >&2
    echo "  Point DATABASE_URL at a staging/throwaway project, or pass --force if you really mean it." >&2
    exit 2
  fi
fi
: "${DATABASE_URL:?set DATABASE_URL to the target database (never the live ref)}"
command -v psql >/dev/null 2>&1 || { echo "✗ psql not installed (apt install postgresql-client)." >&2; exit 2; }

mig_dir="supabase/migrations"
down_dir="scripts/rollback"
fail=0

expect_sql() { # label, sql — expects a single 't' row
  local label="$1" sql="$2" out
  out="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "$sql")"
  if [ "$out" = "t" ]; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label (got: $out)"
    fail=1
  fi
}

policy_exists="select exists(select 1 from pg_policies where schemaname='public' and tablename='%s' and policyname='%s');"
col_exists="select exists(select 1 from information_schema.columns where table_schema='public' and table_name='%s' and column_name='%s');"

echo "→ P0 — confirm the target is at 0018+0019 before drilling (preconditions)..."
expect_sql "'subscriptions_user_uidx' exists (pre)" "select (to_regclass('public.subscriptions_user_uidx') is not null);"
expect_sql "'runs_one_active_per_invoice' exists (pre)" "select (to_regclass('public.runs_one_active_per_invoice') is not null);"
expect_sql "messages.status exists (pre)" "$(printf "$col_exists" messages status)"

echo "→ 0019_down.sql — restore the client Data-API write path..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$down_dir/0019_down.sql"
echo "→ 0018_down.sql — restore pre-0018 schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$down_dir/0018_down.sql"

echo "→ V1 — rollback artifacts gone..."
expect_sql "subscriptions_user_uidx dropped" "select (to_regclass('public.subscriptions_user_uidx') is null);"
expect_sql "runs_one_active_per_invoice dropped" "select (to_regclass('public.runs_one_active_per_invoice') is null);"
expect_sql "payment_plan_requests dropped" "select (to_regclass('public.payment_plan_requests') is null);"
expect_sql "messages.status dropped" "select not exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='status');"
expect_sql "subs_all_own restored" "$(printf "$policy_exists" subscriptions subs_all_own)"
expect_sql "profiles_insert_own restored" "$(printf "$policy_exists" profiles profiles_insert_own)"
expect_sql "invoices_all_own restored" "$(printf "$policy_exists" invoices invoices_all_own)"

echo "→ 0018_hardening_fixes.sql forward (re-apply)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$mig_dir/0018_hardening_fixes.sql"
echo "→ 0019_api_write_boundary.sql forward (re-apply)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$mig_dir/0019_api_write_boundary.sql"

echo "→ V2 — forward state restored..."
expect_sql "subscriptions_user_uidx back" "select (to_regclass('public.subscriptions_user_uidx') is not null);"
expect_sql "runs_one_active_per_invoice back" "select (to_regclass('public.runs_one_active_per_invoice') is not null);"
expect_sql "payment_plan_requests back" "select (to_regclass('public.payment_plan_requests') is not null);"
expect_sql "messages.status back" "$(printf "$col_exists" messages status)"
expect_sql "subs_all_own gone (0018 forwards)" "select not exists(select 1 from pg_policies where schemaname='public' and tablename='subscriptions' and policyname='subs_all_own');"
expect_sql "payment_plan_all_own gone (0019 forwards)" "select not exists(select 1 from pg_policies where schemaname='public' and tablename='payment_plan_requests' and policyname='payment_plan_all_own');"

echo
if [ "$fail" -eq 0 ]; then
  echo "Rollback drill PASS — 0019_down → 0018_down → forward re-apply all clean."
else
  echo "Rollback drill FAIL — see ✗ lines above."
fi
exit "$fail"