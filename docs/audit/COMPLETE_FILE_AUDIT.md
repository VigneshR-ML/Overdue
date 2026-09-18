# COMPLETE_FILE_AUDIT.md — per-file inventory (reconciles all tracked files)

- Repo: `VigneshR-ML/Overdue` · Audited base: `d005e34e` · Master-pass HEAD: `f2b3d2c`
- Inventory source: `git ls-files | grep -v '^.opencode/'` at base → **237 files** =
  119 `.ts` (of which **24 are vitest suites**) + 75 `.tsx` + 18 migrations +
  5 audit docs + 19 other (config/static/scripts/workflows).
- HEAD adds 2 files (`src/lib/recovery/paid.ts`, `docs/audit/WORKFLOW_MAP.md`) → 239.
- Every path below is present in the inventory; files prefixed `[NEW]` were
  added during the audit fixes.
- Status: `[R]` read & assessed · `[E]` edited in this pass · `[I]` inventoried
  (role known, not line-audited). "Issues" = defects found, tagged to BUG_REPORT.

## Config, ops, top level

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `.env.example` | env template: CRON/SIGNING secrets, provider keys, SUPABASE_* | ✔ | none | — | — | `[R]` |
| `.eslintrc.json` | ESLint config | — | none | — | — | `[I]` |
| `.github/workflows/dispatch.yml` | hourly cron → /api/cron/dispatch, fails on non-200/`ok:false` | ✔ | D12 | capture+print+exit 1 | — | `[R][E]` |
| `.gitignore` | ignores | — | none | — | — | `[I]` |
| `next.config.mjs` | security headers (CSP/HSTS/DENY/no-store on API & auth pages) | ✔ | none | — | — | `[R]` |
| `opencode.json` | agent config | — | none | — | — | `[I]` |
| `package.json` / `package-lock.json` | deps, scripts (test/tsc/build/lint) | ✔ | no playwright | — | — | `[R]` |
| `postcss.config.mjs` | postcss | — | none | — | — | `[I]` |
| `public/products/overdue-icon.png` | icon | — | none | — | — | `[I]` |
| `README.md` | docs; ladder copy `[1,6,7,7]` aligned | ✔ | D27 | — | — | `[R]` |
| `scripts/dodo-e2e.sh` | dodo e2e harness | — | none | — | — | `[I]` |
| `scripts/launch-check.sh` | pre-launch checks | — | none | — | — | `[I]` |
| `scripts/probe-computes.ts` | db compute probe | — | none | — | — | `[I]` |
| `scripts/tsx-register.mjs` | tsx helper for scripts | — | none | — | — | `[I]` |
| `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts` | toolchain | ✔ | none | — | — | `[R]` |
| `vercel.json` | vercel (crons intentionally empty) | ✔ | none | — | — | `[I]` |

## Supabase migrations (18) + config

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|----------|----------|--------|---------|-------|--------|
| `supabase/config.toml` | local stack | — | none | — | — | `[I]` |
| `0001_init.sql` | core tables/RLS/trigger seeds | ✔ | D09 | seeds `[1,6,7,7]` | — | `[R][E]` |
| `0002_credentials.sql` | creds table | — | none | — | — | `[I]` |
| `0003_vault_credentials.sql`, `0007_vault_wrappers.sql` | vault secret storage + SECURITY DEFINER wrappers | — | none | — | — | `[I]` |
| `0004_dispatch_states.sql` | runs status machine | ✔ | none | — | — | `[R]` |
| `0005_indexes_and_constraints.sql` | dedupe constraints | ✔ | none | — | — | `[I]` |
| `0006_delivery_tracking.sql` | messages.delivered_at/open | ✔ | none | — | — | `[R]` |
| `0008_provider_account.sql` | integrations.provider_account_id (tenant→user) | ✔ | none | — | — | `[R]` |
| `0009_payment_url.sql` | payment_url column | — | none | — | — | `[I]` |
| `0010_promise_to_pay.sql` | runs promise columns | — | none | — | — | `[I]` |
| `0011_ai_usage.sql` | AI quota table | ✔ | none | — | — | `[R]` |
| `0012_credentials_rls.sql` | credentials RLS | — | none | — | — | `[I]` |
| `0013_reply_intel.sql` | reply_intel + disputes | ✔ | none | — | — | `[R]` |
| `0014_lemon_billing.sql`, `0015_dodo_billing.sql`, `0017_paddle_billing.sql` | billing tables + billing_provider | ✔ | none | — | — | `[R]` |
| `0016_settlements.sql` | settlement_offers/events + matrix index | ✔ | none | — | — | `[R]` |
| `0018_hardening_fixes.sql` | RLS drop, dedupe, active-run index, messages.status, offer tracking, plan requests, ladder repair | ✔ | D05/D08/D09/D10/D13/D15/D20/D24 | see FIX_CHANGELOG | — | `[R][E]` |
| `supabase/.temp/linked-project.json` | local-only link data | — | — | — | — | `[I]` |

## `src/app/api` — server routes (35)

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `account/delete/route.ts` | account deletion; cancels Paddle+Dodo, blocks on failure | ✔ | D16 | — | — | `[R][E]` |
| `account/export/route.ts` | full data export (profiles by id, all new tables) | ✔ | D17 | — | — | `[R][E]` |
| `ai/draft/route.ts` | AI draft proxy (ownership-checked, rate-limited, tone/length caps) | ✔ | none new | — | — | `[R]` |
| `billing/dodo/checkout/route.ts` | Dodo checkout session | — | none | — | — | `[I]` |
| `billing/paddle/checkout/route.ts` | Paddle checkout session | — | none | — | — | `[I]` |
| `billing/paddle/overlay-error/route.ts` | overlay error page | — | none | — | — | `[I]` |
| `billing/status/route.ts` | billing status snapshot | — | none | — | — | `[I]` |
| `clients/route.ts` | create client | ✔ | D31 | email format validation | — | `[R][E]` |
| `cron/dispatch/route.ts` | cron gateway (CRON_SECRET, rate limit) | ✔ | none | — | — | `[R]` |
| `health/route.ts` | health probe | — | none | — | — | `[I]` |
| `integrations/csv/route.ts` | CSV import (counts, caps, quota skip) | ✔ | D18 | — | — | `[R][E]` |
| `integrations/paypal/save/route.ts` | save paypal app creds | — | none | — | — | `[I]` |
| `integrations/[provider]/route.ts` | POST sync + DELETE disconnect | ✔ | none | — | — | `[R]` |
| `integrations/stripe/{start,callback}/route.ts` | stripe connect OAuth | — | none | — | — | `[I]` |
| `integrations/xero/{start,callback}/route.ts` | xero OAuth | — | none | — | — | `[I]` |
| `invoices/[id]/route.ts` | PATCH (mark_paid → reconcilePaidWork) + POST attach sequence | ✔ | D19 | reuses shared reconcile | — | `[R][E]` |
| `invoices/[id]/send/route.ts` | manual send-now | — | none | — | — | `[I]` |
| `invoices/route.ts` | manual invoice create (+caps, email/amount/pay-url validation) | ✔ | none | — | — | `[R]` |
| `r/[token]/pay/route.ts` | debtor pay-intent (discounted link or 409) | ✔ | D03 | — | — | `[R][E]` |
| `r/[token]/resolve/route.ts` | accept/promise/dispute/plan_request | ✔ | D02/D05/D24 | — | — | `[R][E]` |
| `sequences/route.ts` | CRUD ladders; PUT applies fresh steps, activates runs | ✔ | none new | — | — | `[R]` |
| `settlements/approve/route.ts` | approve offer → link + supersede | ✔ | none new | — | — | `[R]` |
| `settlements/recommend/route.ts` | recommendation (read-only) | ✔ | none | — | — | `[R]` |
| `tools/smart-csv/{map,insights}/route.ts` | AI header mapping + insights | — | none | — | — | `[I]` |
| `webhooks/dodo/route.ts` + `route.test.ts` | Dodo webhook (verify, idempotent) | ✔ | none | — | suite | `[R]` |
| `webhooks/email/route.ts` | inbound email (Svix + legacy + GET verify) | ✔ | D25 | — | — | `[R][E]` |
| `webhooks/paddle/route.ts` | Paddle webhook (verify, dedupe) | ✔ | none | — | — | `[R]` |
| `webhooks/paypal/route.ts` | PayPal paid → markInvoicePaid(amount), 500 on write error | ✔ | D29 | amount + 500 | — | `[R][E]` |
| `webhooks/resend/route.ts` | Resend inbound + outbound events | ✔ | D06/D10 | — | — | `[R][E]` |
| `webhooks/stripe/route.ts` | Stripe paid → markInvoicePaid(amount_paid), 500 on write error | ✔ | D29 | amount + 500 | — | `[R][E]` |
| `webhooks/xero/route.ts` | Xero paid (status fetch, never optimistic), 500 on write error | ✔ | D29 | 500 on error | — | `[R][E]` |

## `src/app` — pages (40)

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `(app)/dashboard/page.tsx` + `loading.tsx` | dashboard; live-DB metrics (getAgingTotals/getRecoveryQueue) | ✔ | none (Q verified live) | — | — | `[R]` |
| `(app)/error.tsx`, `(app)/layout.tsx`, `(app)/loading.tsx` | app shell | — | none | — | — | `[I]` |
| `(app)/insights/page.tsx` | aging/DSO/forecast from `getInsights` | — | none | — | — | `[I]` |
| `(app)/invoices/page.tsx` + `loading.tsx` | list (InvoiceTable) | ✔ | D20 | — | — | `[R][E]` |
| `(app)/clients/page.tsx` | client health | — | none | — | — | `[I]` |
| `(app)/sequences/{page,new,[id]}.tsx` + `loading.tsx` | ladder CRUD UI | — | none | — | — | `[I]` |
| `(app)/settings/{page,loading,integrations,billing}.tsx` | settings UI | — | none | — | — | `[I]` |
| `(app)/tools/page.tsx`, `tools/[slug]/page.tsx`, `tools/smart-csv/page.tsx` | tool pages | — | none | — | — | `[I]` |
| `auth/callback/page.tsx` | PKCE callback | — | none | — | — | `[I]` |
| `error.tsx`, `globals.css`, `icon.svg`, `layout.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` | app infra | — | none | — | — | `[I]` |
| `login/page.tsx`, `signup/page.tsx`, `onboarding/page.tsx` | auth pages | — | none | — | — | `[I]` |
| `page.tsx` | landing | ✔ | D27 | LADDER_STEPS `[1,6,7,7]` | — | `[R][E]` |
| `pricing/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `refund/page.tsx`, `security/page.tsx` | legal/marketing | — | none | — | — | `[I]` |
| `r/[token]/page.tsx` | debtor resolution view (viewed stamp, no status flip) | ✔ | D02 | — | — | `[R][E]` |
| `templates/page.tsx`, `templates/[slug]/page.tsx` | email template pages | ✔ | D27 | ladder `[1,6,7,7]` | — | `[R][E]` |

## `src/components` (38)

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `app-shell/{dock,page-header,topbar}.tsx` | app chrome | — | none | — | — | `[I]` |
| `auth/{auth-code-handler,auth-form,auth-notice}.tsx` | auth UI | — | none | — | — | `[I]` |
| `billing/{plan-manager,pro-price}.tsx` | billing UI | — | none | — | — | `[I]` |
| `calculators/{realtime-calculator,tool-detail}.tsx` | tools UI | — | none | — | — | `[I]` |
| `error-ledger.tsx` | error boundary UI | — | none | — | — | `[I]` |
| `ledger/add-client.tsx`, `add-invoice.tsx` | manual entry | — | none | — | — | `[I]` |
| `ledger/aging-strip.tsx`, `urgency-queue.tsx`, `recovery-queue.tsx`, `recovery-steps.tsx`, `receipt-ticker.tsx`, `reply-thread.tsx` | dashboards | — | none | — | — | `[I]` |
| `ledger/escalation-ladder.tsx` | ladder visual | ✔ | D27 | fallback `[1,6,7,7]` | — | `[R][E]` |
| `ledger/invoice-table.tsx` | table; mark-paid → PATCH; pause seeded from run | ✔ | D19/D20 | — | — | `[R][E]` |
| `ledger/sequence-editor.tsx` | ladder editor (delay hint accurate) | ✔ | none | — | — | `[R]` |
| `marketing/copy-email-button.tsx` | clipboard (awaits success) | ✔ | none | — | — | `[R]` |
| `marketing/{landing-tool-teaser,site}.tsx` | landing UI | — | none | — | — | `[I]` |
| `settings/{account-data-controls,integrations-manager}.tsx` | settings UI | ✔ | D16 | — | — | `[R][E]` |
| `settlements/resolution-view.tsx` | debtor card → /accept,/pay | ✔ | D03 | — | — | `[R][E]` |
| `settlements/settlement-card.tsx` | owner approve UI | ✔ | D30 | clipboard await + real expiry | — | `[R][E]` |
| `settlements/settlement-strip.tsx` | dashboard strip | — | none | — | — | `[I]` |
| `tools/smart-csv-importer.tsx` | CSV importer UI | — | none | — | — | `[I]` |
| `ui/{badge,button,card,empty-state,input,select,switch}.tsx` | primitives | — | none | — | — | `[I]` |

## `src/hooks` / `src/middleware.ts` / `src/types`

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `hooks/use-supabase.ts` | client hook | — | none | — | — | `[I]` |
| `middleware.ts` | canonical-host 307 + session refresh (never bounces API/auth callback) | ✔ | none | — | — | `[R]` |
| `types/index.ts` | Invoice/Client/Run/Sequence/Step/Tone | ✔ | none | — | — | `[R]` |

## `src/lib` (75)

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `ai/draft.ts` | drafting + quota (plan-gated) | ✔ | D14/V | prompt-injection hardening | `draft.test.ts` | `[R][E]` |
| `ai/{promise,reply,providers,quota}.ts` | classification, provider rollover, quota | — | none | — | 4 suites | `[I]` |
| `analysis/{calculators,forecast,health,next-action,risk}.ts` | pure math engines | — | none | — | 5 suites | `[I]` |
| `auth/{local-session,require-user,session}.ts` | session helpers | — | none | — | — | `[I]` |
| `billing/entitlement.ts` | canonical plan resolution | ✔ | D14 | — | `entitlement.test.ts` (11) | `[R][E]` |
| `billing/plan.ts`, `limits.ts` | getPlan + limits | ✔ | D14 | — | — | `[R][E]` |
| `billing/paddle-events.ts` / `dodo-events.ts` | single-row upsert on user_id, default-free | ✔ | D15 | — | both rewritten | `[R][E]` |
| `billing/reconcile.ts` | reconcile + customer-id attach on user_id | ✔ | D15 | — | — | `[R][E]` |
| `calculators/types.ts` | tool types | — | none | — | — | `[I]` |
| `csv/smart-csv.ts` | AI header mapping | — | none | — | `smart-csv.test.ts` | `[I]` |
| `db/queries.ts` | all dashboard/insight loaders (live tables; paused flag) | ✔ | D20 | — | `queries.test.ts` | `[R][E]` |
| `dodo/{checkout,helpers,server}.ts` | Dodo SDK wrappers + cancel | ✔ | none | — | — | `[R]` |
| `integrations/credentials.ts` | vault-first credential store | ✔ | none | — | — | `[R]` |
| `integrations/csv.ts` | RFC-4180 parser, amount>0 | ✔ | D18 | — | `csv.test.ts` | `[R][E]` |
| `integrations/oauth.ts` | OAuth state sign/verify + appUrl | ✔ | none | — | — | `[R]` |
| `integrations/paid-webhooks.ts` | signatures + markInvoicePaid(amount,error)+reconcile | ✔ | D29 | paid_cents, {flipped,error}, reconcile | `paid-webhooks.test.ts` (17) | `[R][E]` |
| `integrations/{provider,paypal,stripe,stripe-flag,xero,sync}.ts` | provider shapes + fetchers + sync loop | ✔ | none new (L: idempotent-upsert design documented in WORKFLOW_MAP) | — | — | `[R]` |
| `paddle/{checkout,helpers,server}.ts` | Paddle wrappers + cancel | ✔ | none | — | — | `[R]` |
| `recovery/paid.ts` | `[NEW]` shared paid reconciliation (runs/disputes/offers) | ✔ | D19/D29 | — | covered by paid-webhooks.test.ts | `[R][E]` |
| `recovery/settlement.ts` | EV engine (sweep to maxBps, beat-wait) | ✔ | D04 | — | `settlement.test.ts` (8) | `[R][E]` |
| `recovery/token.ts` | resolution-token HMAC | ✔ | none | — | `token.test.ts` (2) | `[R]` |
| `resend/send.ts` | outbound send (resend_message_id) | ✔ | none | — | `send.test.ts` (2) | `[R]` |
| `scheduler/dispatch.ts` | dispatcher/startRun/inbound (all gates) | ✔ | D05–D11,D14,D24 | — | `dispatch.test.ts` (11) | `[R][E]` |
| `scheduler/inbound.ts`, `thread-ids.ts` | inbound + thread header match | ✔ | D06 | — | `thread-ids.test.ts` (3) | `[R][E]` |
| `seo/{email-templates,tool-calculators}.ts` | marketing content | — | none | — | — | `[I]` |
| `supabase/{admin,client,middleware,server}.ts` | clients | — | none | — | — | `[I]` |
| `utils/format.ts`, `rate-limit.ts`, `receipt-ticker.ts` | utils + limiter presets | ✔ | none | — | `format.test.ts` | `[R]` |
| `webhooks/signatures.ts` | inbound signature (Svix/legacy/Bearer) | ✔ | D25 | — | — | `[R][E]` |

## Docs — `docs/audit` (6)

| File | Purpose | Reviewed | Issues | Changes | Tests | Status |
|------|---------|----------|--------|---------|-------|--------|
| `BUG_REPORT.md` | 28-defect register (26 fixed on HEAD) | ✔ | — | +D29–D32 | — | `[E]` |
| `COMPLETE_FILE_AUDIT.md` | this inventory | ✔ | — | per-file table | — | `[E]` |
| `FIX_CHANGELOG.md` | change audit trail | ✔ | — | +D29–D32 | — | `[E]` |
| `TEST_RESULTS.md` | evidence | ✔ | — | 197 tests | — | `[E]` |
| `LAUNCH_READINESS.md` | gates G1–G11 | ✔ | — | +D29–D32 | — | `[E]` |
| `WORKFLOW_MAP.md` | `[NEW]` state machines W1–W7 | ✔ | — | new | — | `[E]` |

## Verdicts
- **Sound / verified:** analysis math, token HMAC, settlement EV (D04), rate
  limits, webhook signatures (D25/D29), entitlement (D14), thread matching
  (D06), dashboard metrics (live-derived), CSP/headers, reconcile-on-paid
  (D19/D29 shared path).
- **Fixed on HEAD:** see BUG_REPORT.md D02–D20, D24, D25, D27, D29–D32.
- **Deferred/verify:** D21/D22/D23/D26/D28 (registered in the prior source
  audit, not reproduced in this pass); E2E runner; live provider smoke;
  live migration apply (G5/G6/G7 in LAUNCH_READINESS.md).