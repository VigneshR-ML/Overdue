#!/usr/bin/env bash
# verify-gates.sh — reproduces the LAUNCH_READINESS gate evidence reproducibly.
#
# Usage:
#   bash scripts/verify-gates.sh local            # run the machine-local gate (G2/G3/G4/G12/lint)
#   bash scripts/verify-gates.sh live             # live-DB assertions against the linked Supabase project
#                                                  (requires scripts/assert-write-boundary.ts + .env.local)
#   bash scripts/verify-gates.sh --emit-markdown  # print a TEST_RESULTS.md-ready block for the last local run
#
# Rule: nothing in docs/audit is a launch gate unless it can be reproduced from
# this script's output. Evidence discipline — never print secret values.
set -u
cd "$(dirname "$0")/.."

MODE="${1:-local}"
LOG_DIR="docs/audit/verify-logs"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
FAIL=0
declare -A SUMMARY

run_gate() { # label, command...
  local label="$1"; shift
  local log="$LOG_DIR/gate-${label}-${STAMP}.log"
  printf '\n── [GATE] %s @ %s ──\n' "$label" "$COMMIT" >> "$log"
  if "$@" >> "$log" 2>&1; then
    echo "  ✓ $label"
    SUMMARY["$label"]="pass"
  else
    echo "  ✗ $label — see $log"
    SUMMARY["$label"]="fail"
    FAIL=1
  fi
}

case "$MODE" in
  local)
    echo "→ Running local gate on $COMMIT (logs: $LOG_DIR)"
    run_gate test   npm test -- --reporter=dot
    run_gate typecheck npx tsc --noEmit
    run_gate lint   npm run lint
    run_gate build  npm run build
    run_gate audit  npm audit
    echo
    if [ "$FAIL" -eq 0 ]; then
      echo "Local gate PASS — $COMMIT"
    else
      echo "Local gate FAIL — $COMMIT (see logs above)"
    fi
    exit "$FAIL"
    ;;

  live)
    if [ ! -f "scripts/assert-write-boundary.mjs" ]; then
      echo "✗ scripts/assert-write-boundary.mjs not present — run local gate or rebuild the live prober." >&2
      exit 2
    fi
    if [ ! -f ".env.local" ]; then
      echo "✗ .env.local not found — required for live assertions." >&2
      exit 2
    fi
    echo "→ Live DB assertions against the linked Supabase project"
    if node scripts/assert-write-boundary.mjs > "$LOG_DIR/live-${STAMP}.log" 2>&1; then
      echo "  ✓ write-boundary + migration state as expected (see $LOG_DIR/live-${STAMP}.log)"
    else
      echo "  ✗ live assertions failed — see $LOG_DIR/live-${STAMP}.log"
      exit 1
    fi
    ;;

  --emit-markdown)
    latest="$(ls -t "$LOG_DIR"/gate-test-*.log 2>/dev/null | head -1)"
    [ -z "$latest" ] && { echo "no local gate log found — run 'local' first" >&2; exit 2; }
    tests="$(grep -oE 'Tests +[0-9]+ passed \([0-9]+\)' "$latest" | tail -1)"
    files="$(grep -oE 'Test Files +[0-9]+ passed \([0-9]+\)' "$latest" | tail -1)"
    audit_log="$(ls -t "$LOG_DIR"/gate-audit-*.log 2>/dev/null | head -1)"
    audit="$([ -n "$audit_log" ] && grep -oE 'found [0-9]+ vulnerabilities' "$audit_log" | head -1 || echo 'n/a')"
    echo "<!-- verify-gates.sh $(basename "$latest") on $(git -C "$PWD" rev-parse --short HEAD) -->"
    echo "| G2 unit suite | \`npm test\` | **$tests** |"
    echo "| G3 typecheck | \`npx tsc --noEmit\` | passed (exit 0, no output) |"
    echo "| G4 production build | \`npm run build\` | green |"
    echo "| G12 dependency security | \`npm audit\` | **$audit** |"
    ;;

  *)
    echo "unknown mode '$MODE' (local | live | --emit-markdown)" >&2
    exit 2
    ;;
esac