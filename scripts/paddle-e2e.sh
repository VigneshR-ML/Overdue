#!/usr/bin/env bash
# Paddle Billing live sandbox smoke test.
#
# Reads Paddle credentials from .env.local and runs a real read-only check
# against the Paddle API, WITHOUT printing any secrets. Run it after pasting a
# sandbox key into .env.local:
#
#   bash scripts/paddle-e2e.sh
#
# Exits 0 on success, 1 on missing config, 2 on API errors.

set -u
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ ${ENV_FILE} not found — copy .env.example first." >&2
  exit 1
fi

# Load only the vars we need (no secrets echoed).
PADDLE_ENV="$(awk -F= '/^NEXT_PUBLIC_PADDLE_ENVIRONMENT=/{print $2}' "$ENV_FILE")"
PADDLE_API_KEY="$(awk -F= '/^PADDLE_API_KEY=/{print $2}' "$ENV_FILE")"
PADDLE_VENDOR="$(awk -F= '/^NEXT_PUBLIC_PADDLE_VENDOR_ID=/{print $2}' "$ENV_FILE")"
PADDLE_PRICE="$(awk -F= '/^PADDLE_PRICE_PRO_MONTHLY=/{print $2}' "$ENV_FILE")"

BASE="https://sandbox-api.paddle.com"
if [ "$PADDLE_ENV" = "live" ]; then BASE="https://api.paddle.com"; fi

if [ -z "$PADDLE_API_KEY" ]; then
  echo "✗ PADDLE_API_KEY is empty in ${ENV_FILE}" >&2
  echo "  Paste a sandbox key like   pdl_sdbx_apikey_...   and re-run." >&2
  exit 1
fi

fail() { echo "✗ $1" >&2; exit 2; }

echo "→ Paddle endpoint: $BASE"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/prices" -H "Authorization: Bearer ${PADDLE_API_KEY}")"
[ "$STATUS" = "200" ] || fail "GET /prices returned HTTP $STATUS (bad/expired key?)"
echo "✓ API key works (HTTP 200)"

echo "→ Fetching products…"
PRODUCTS="$(curl -s "$BASE/products" -H "Authorization: Bearer ${PADDLE_API_KEY}")"
echo "  $(echo "$PRODUCTS" | grep -o '"id": *"' | wc -l | tr -d ' ') products"

if [ -z "$PADDLE_PRICE" ]; then
  echo "⚠ PADDLE_PRICE_PRO_MONTHLY empty — Pro plan will not map in webhooks."
else
  echo "→ Verifying price id $PADDLE_PRICE exists…"
  PSTATUS="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/prices/${PADDLE_PRICE}" -H "Authorization: Bearer ${PADDLE_API_KEY}")"
  [ "$PSTATUS" = "200" ] || fail "PADDLE_PRICE_PRO_MONTHLY not found (HTTP $PSTATUS)"
  echo "✓ Price id exists"
fi

if [ -n "$PADDLE_VENDOR" ]; then
  echo "→ Vendor id set (length ${#PADDLE_VENDOR})"
else
  echo "⚠ NEXT_PUBLIC_PADDLE_VENDOR_ID empty — client checkout won't load."
fi

echo
echo "All Paddle sandbox checks passed. 🎉"
exit 0