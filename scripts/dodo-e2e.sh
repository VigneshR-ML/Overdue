#!/usr/bin/env bash
# Dodo Payments end-to-end smoke test for launch.
# Depends on .env.local being populated (run scripts/launch-check.sh first).
set -euo pipefail

ENV_FILE="${1:-.env.local}"
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE missing"; exit 1; }

echo "--- Dodo Payments e2e (target: $ENV_FILE) ---"

BASE_URL="$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
[ -n "$BASE_URL" ] || { echo "✗ NEXT_PUBLIC_APP_URL not set"; exit 1; }

ENV_MODE="$(grep -E '^DODO_PAYMENTS_ENVIRONMENT=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr '[:upper:]' '[:lower:]')"
ENV_MODE="${ENV_MODE:-test_mode}"
echo "· environment: $ENV_MODE"
echo "· base: $BASE_URL"
echo
echo "1) Create a Pro checkout and confirm it redirects to Dodo's hosted page:"
echo "   curl -X POST $BASE_URL/api/billing/dodo/checkout  → expect { ok, url } on https://${ENV_MODE%.*}.dodopayments.com/*"
echo "2) Complete checkout with a test card in the Dodo dashboard."
echo "3) Confirm the webhook hit: https://$BASE_URL/api/webhooks/dodo (signed)."
echo "4) Check the user's Pro row in Supabase subscriptions (plan=pro, status=active)."
echo "5) Click 'Open billing portal' on /settings/billing → expect a customer-portal link."
echo
echo "Manual checks only — no automated assertions (no paying users yet)."