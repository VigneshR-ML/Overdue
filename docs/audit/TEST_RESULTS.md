# TEST_RESULTS.md — evidence for the fix pass

## Environment
- Directory: `/home/leodas/mvp/overdue`
- Node: `v22.23.1` (npm), runner: Vitest `v2.1.9`
- Base commit: `d005e34e62628cb2217c515552ffdda9cd153e0b`

## Baseline (before this pass, prior session)
- Unit tests: **180 passed / 0 failed** (22 files)
- `npm run build`: green
- Known failing after billing refactor (mid-pass): 2 test files, 7 failed
  (`paddle-events.test.ts`, `dodo-events.test.ts` — asserted the old
  update/onConflict-subid/default-pro behavior)

## Current (after fixes)

### Unit tests — full suite
Command: `npx vitest run`
Result: **193 passed, 0 failed** (24 files)

```
Test Files  24 passed (24)
     Tests  193 passed (193)
```

New/updated suites:
- `src/lib/billing/paddle-events.test.ts` (8) — upsert keyed on user_id,
  plan preservation, status mapping incl. cancellation grace, transaction sub id
  from `subscription_id`, default-free on unknown product.
- `src/lib/billing/dodo-events.test.ts` (8) — same, Dodo flavor.
- `src/lib/billing/entitlement.test.ts` (11) — `planForSubscription` matrix
  (no row, non-pro, active, past_due/paused/on_hold, failed/expired revocation,
  cancelled grace window), `graceUntil`.
- `src/lib/scheduler/thread-ids.test.ts` (3) — `extractMessageIdTokens`,
  `extractThreadHeaders` (array + object shapes).
- `src/lib/recovery/settlement.test.ts` (8) — added off-grid `maxIncentiveBps`,
  single 0-bps baseline, ascending order assertions.

### Typecheck
Command: `npx tsc --noEmit`
Result: **passed (exit 0, no output)**

### Production build
Command: `npm run build`
Result: **passed** — all routes compiled; static pages prerendered; template
dynamic params generated (`/templates/[slug]`, `/tools/[slug]`).

### What the suite exercises (coverage by area)
- Scheduler: dispatch batches, run creation guards, stale-processing recovery,
  promise handling, reply classification → `dispatch.test.ts`, `webhooks/dodo`
  route test.
- Billing: Paddle + Dodo event → entitlement mapping, reconcile, quota.
- Recovery/settlements: recommendation engine incl. new D04 behavior, expiry,
  token sign/verify.
- Integrations: CSV parsing (messy headers + canonical), paid-webhooks.
- Analysis: calculators, forecast, health, risk, next-action.
- AI: draft, promise, providers, quota, reply.
- Resend: send path.
- DB: queries helpers.

## Gaps to close before relying on this as launch evidence
1. **E2E (Playwright):** `@playwright/test` is not installed and no browser
   binary was available in this environment — `test-results/` is empty. Page-
   level flows (accept → pay, mark-paid reconcile, pause/resume seeding) are
   covered by unit tests and `tsc`, not a headless browser.
2. **Live database:** migration `0018_hardening_fixes.sql` has NOT been applied
   against a real Supabase project here. The dedupe step and the copy-protected
   index DO blocks are SQL that behaved correctly in review and locally, but
   apply on a fresh project (`supabase db reset`) and on the production DB with
   `supabase db push`, then re-run the smoke checks in `LAUNCH_READINESS.md`.
3. **Integration/E2E billing:** no live Paddle/Dodo/Resend calls were made
   (no provider keys). User-facing and webhook logic is unit-covered.

## Reproduction commands
```bash
npm ci
npx vitest run        # 193 tests
npx tsc --noEmit      # clean
npm run build         # green
```