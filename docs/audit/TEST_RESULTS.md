# TEST_RESULTS.md — evidence for the fix pass

## Reanalysis verification — 2026-09-20

- Node: `v24.19.0`; Vitest: `v5.0.1`; Next.js: `v16.3.5`.
- `npm test`: **217 passed, 0 failed** (28 files).
- `npm run lint`: passed with 0 warnings/errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; 25 static pages generated and all dynamic/API
  routes compiled. Fonts are bundled, so the build no longer requires Google
  Fonts network access.
- `npm audit`: **0 vulnerabilities** (production and development dependencies).
- Playwright/Chromium smoke (`npm run test:e2e`): **1 passed**, covering `/`, `/pricing`, `/templates`, `/login`, and
  `/signup` returned meaningful content with expected titles/headings and no
  Next.js error overlay. This pass found and fixed the root auth handler crash
  on unconfigured Supabase previews and the CSP block on Vercel telemetry.
- Calendar-date tests also pass under `TZ=America/Los_Angeles` and
  `TZ=Asia/Kolkata` (see final release command output).

Live Supabase policy application, authenticated UI flows, sandbox provider
transactions, and deployed-provider webhooks remain environment-dependent and
were not represented as completed by this local pass.

## Environment
- Directory: `/home/leodas/mvp/overdue`
- Node: `v22.23.1` (npm), runner: Vitest `v2.1.9`
- Hardening-pass HEAD: `f2b3d2c` (base `d005e34e62628cb2217c515552ffdda9cd153e0b`)
- Master-pass re-ran the full gate on top of `f2b3d2c`:
  `npx tsc --noEmit` (clean), `npx next lint` (clean), `npx vitest run`
  (**197/197**), `npm run build` (green).

## Baseline (hardening pass, prior session)
- Unit tests: 180 passed → **193 passed** (24 files) after hardening fixes.
- `npm run build`: green.

## Current (master pass)

### Unit tests — full suite
Command: `npx vitest run`
Result: **197 passed, 0 failed** (24 files)

```
 Test Files  24 passed (24)
      Tests  197 passed (197)
```

New/updated suites this pass:
- `src/lib/integrations/paid-webhooks.test.ts` (17) — rewritten for D29
  `markInvoicePaid({paidCents}) → {flipped,error}`: default full-amount flip
  writes `paid_cents`, provider amount clamped to balance, reconciliation only
  on a real flip (runs/disputes/offers + `paid` event), write errors surfaced,
  unscoped/no-invoice no-ops.
- Earlier hardening suites retained: `paddle-events` (8), `dodo-events` (8),
  `entitlement` (11), `thread-ids` (3), `settlement` (8).

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

## Historical gaps from the earlier pass
1. **Authenticated E2E:** public browser smoke now exists, but authenticated
   flows still require an identifiable Supabase project and test account.
2. **Live database:** migrations `0018_hardening_fixes.sql` and
   `0019_api_write_boundary.sql` have NOT been applied
   against a real Supabase project here. The dedupe step and the copy-protected
   index DO blocks are SQL that behaved correctly in review and locally, but
   apply on a fresh project (`supabase db reset`) and on the production DB with
   `supabase db push`, then re-run the smoke checks in `LAUNCH_READINESS.md`.
3. **Integration/E2E billing:** no live Paddle/Dodo/Resend/PayPal/Xero calls were made
   (no provider keys). User-facing and webhook logic is unit-covered.

## Reproduction commands
```bash
npm ci
npm test              # 217 tests
npx tsc --noEmit      # clean
npm run lint          # clean
npm run build         # green
npm audit             # 0 vulnerabilities
npx playwright install chromium
npm run test:e2e      # public routes + tablet overflow
```
