#!/usr/bin/env bash
# Pre-launch env checker — reports MISSING vs OK without printing secrets.
# Usage: bash scripts/launch-check.sh [--env .env.local]
set -u
cd "$(dirname "$0")/.."

ENV_FILE="${1:---env}"
# support both: launch-check.sh and launch-check.sh --env .env.local
if [ "$ENV_FILE" = "--env" ]; then ENV_FILE="${2:-.env.local}"; fi

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found — copy .env.example first." >&2
  exit 1
fi

get_len() {
  # $1 = KEY → prints length of value (0 if missing/empty). Never prints value.
  local key="$1" line val
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [ -z "$line" ]; then echo 0; return; fi
  val="${line#*=}"
  # strip surrounding quotes
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  echo "${#val}"
}

fail=0
check_required() {
  local key="$1" len
  len="$(get_len "$key")"
  if [ "$len" -gt 0 ]; then echo "✓ $key (len=$len)"
  else echo "✗ $key MISSING/EMPTY"; fail=1; fi
}
check_optional() {
  local key="$1" len
  len="$(get_len "$key")"
  if [ "$len" -gt 0 ]; then echo "✓ $key (len=$len, optional)"
  else echo "- $key empty (optional)"; fi
}

echo "→ Checking $ENV_FILE (values never printed)"
echo "--- Supabase (required) ---"
check_required "NEXT_PUBLIC_SUPABASE_URL"
check_required "NEXT_PUBLIC_SUPABASE_ANON_KEY"
check_required "SUPABASE_SERVICE_ROLE_KEY"

echo "--- App (required) ---"
check_required "NEXT_PUBLIC_APP_URL"
check_required "APP_ENV"

echo "--- Paddle billing, PRIMARY (required for launch) ---"
check_required "PADDLE_API_KEY"
check_required "PADDLE_WEBHOOK_SECRET"
check_required "PADDLE_ENVIRONMENT"
check_required "PADDLE_PRICE_PRO_MONTHLY"
check_required "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"

if grep -Eq '^DODO_FALLBACK_ENABLED=(true|"true")$' "$ENV_FILE"; then
  echo "--- Dodo Payments billing, ENABLED fallback (required) ---"
  check_required "DODO_PAYMENTS_API_KEY"
  check_required "DODO_PAYMENTS_WEBHOOK_KEY"
  check_required "DODO_PAYMENTS_ENVIRONMENT"
  check_required "DODO_PRODUCT_PRO_MONTHLY"
else
  echo "--- Dodo Payments billing, disabled fallback ---"
  echo "- Dodo credentials not required (DODO_FALLBACK_ENABLED is not true)"
fi

echo "--- Resend + inbound (required for dispatch) ---"
check_required "RESEND_API_KEY"
check_required "RESEND_FROM_EMAIL"
check_required "RESEND_WEBHOOK_SECRET"
check_required "REPLY_TO_EMAIL"
check_required "INBOUND_WEBHOOK_SECRET"

echo "--- Scheduler (required) ---"
check_required "CRON_SECRET"

echo "--- AI / integrations (optional at launch) ---"
check_optional "LLM_API_KEY"
check_optional "LLM_API_GROQ"
check_optional "LLM_FALLBACK_API_KEY"
check_optional "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
check_optional "STRIPE_CLIENT_ID"
check_optional "STRIPE_CLIENT_SECRET"
check_optional "STRIPE_WEBHOOK_SECRET"
check_optional "PAYPAL_CLIENT_ID"
check_optional "PAYPAL_CLIENT_SECRET"
check_optional "PAYPAL_WEBHOOK_ID"
check_optional "XERO_CLIENT_ID"
check_optional "XERO_CLIENT_SECRET"
check_optional "XERO_WEBHOOK_KEY"
check_optional "EMAIL_PREVIEW_SECRET"

echo "--- Repo wiring ---"
[ -f ".github/workflows/dispatch.yml" ] && echo "✓ .github/workflows/dispatch.yml exists (needs DISPATCH_URL + CRON_SECRET secrets)" || { echo "✗ dispatch.yml missing"; fail=1; }
for m in 0001_init.sql 0002_credentials.sql 0003_vault_credentials.sql 0004_dispatch_states.sql 0005_indexes_and_constraints.sql 0006_delivery_tracking.sql 0007_vault_wrappers.sql 0008_provider_account.sql 0009_payment_url.sql 0010_promise_to_pay.sql 0011_ai_usage.sql 0012_credentials_rls.sql 0013_reply_intel.sql 0014_lemon_billing.sql 0015_dodo_billing.sql 0016_settlements.sql 0017_paddle_billing.sql 0018_hardening_fixes.sql 0019_api_write_boundary.sql 0020_maint_assert_write_boundary.sql 0021_workspaces.sql 0022_payment_plans.sql 0023_workflow.sql 0024_precision.sql 0025_launch_blockers.sql 0026_security_reconciliation.sql 20260923023932_owner_notifications.sql 20260923031059_workflow_center.sql 20260923040000_auto_payment_plans.sql; do
  [ -f "supabase/migrations/$m" ] && echo "✓ supabase/migrations/$m" || { echo "✗ supabase/migrations/$m missing"; fail=1; }
done
if grep -q '"crons": \[\]' vercel.json 2>/dev/null; then
  echo "✓ vercel.json crons intentionally empty (GitHub Actions dispatches)"
fi

# Sanity: example.com sender means Resend domain not wired yet
FROM_LINE="$(grep -E '^RESEND_FROM_EMAIL=' "$ENV_FILE" | tail -n 1 || true)"
if echo "$FROM_LINE" | grep -q "example.com"; then echo "⚠ RESEND_FROM_EMAIL still example.com — verify domain first"; fi
APP_URL_LEN="$(get_len NEXT_PUBLIC_APP_URL)"
if [ "$APP_URL_LEN" -gt 0 ] && grep -q "^NEXT_PUBLIC_APP_URL=http://localhost" "$ENV_FILE"; then
  echo "⚠ NEXT_PUBLIC_APP_URL is localhost (ok for dev, must be https://getoverdue.online in Vercel prod)"
fi

echo
if [ "$fail" -eq 0 ]; then echo "All required keys present. Run the authenticated E2E and provider smoke checks next."
else echo "Missing required keys above — paste them into $ENV_FILE (never commit it)."
fi
exit "$fail"
