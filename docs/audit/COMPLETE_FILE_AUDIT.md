# COMPLETE_FILE_AUDIT.md

Inventory of the Overdue codebase (pinned `d005e34e`) with per-file purpose and
disposition after the fix pass. Reviewed files carry a short finding; the rest
are inventoried with their role. This is the paper trail behind
`BUG_REPORT.md` / `FIX_CHANGELOG.md`.

Status legend: `[R]` = read & assessed; `[E]` = edited in this pass;
`[I]` = inventoried (role known, not line-audited).

## Top level
- `package.json` — Next 15 + Supabase; vitest. `[R]` deps present, no playwright.
- `tsconfig.json` — strict; `@/*` alias. `[I]`
- `next.config.mjs` — no transpile of next-auth, etc. `[I]`
- `vitest.config.ts` — alias + jsdom-free env. `[R]`
- `tailwind.config.ts` — TT/theme (`ink`, `moss`, `faint`, …) tokens only,
  no content misses found. `[I]`
- `vercel.json` — crons intentionally empty (Vercel Cron needs Pro). `[I]`
- `playwright.config.ts` / `e2e/` / `test-results/` — scaffolded, no runner
  installed, no tests collected. Known gap (TEST_RESULTS.md).
- `.env.example` — the only env template tracked; `CRON_SECRET`,
  `SIGNING_SECRET`, provider keys, `SUPABASE_*`. `[R]`
- `opencode.json`, `.opencode/` — agent config. `[I]`
- `scripts/` — 4 helper scripts (seeds/reset helpers). `[I]`
- `README.md` — ladder copy `day 1 → nudge 7 →` now matches `[1,6,7,7]` data. `[R]`

## Supabase migrations (17 ancestry + 1 new)
- `0001_init.sql` — core schema; RLS; trigger seeds. `[R]` `[E]` ladder seeds now
  `[1,6,7,7]`; `subs_all_own` originally present (removed in 0018).
- `0002/0003/0007/0012` credentials + vault wrappers. `[I]`
- `0004_dispatch_states.sql` — runs status machine incl. `failed`, `promise_*`. `[R]`
- `0005_indexes_and_constraints.sql` — dedupe uniqueness. `[I]`
- `0006_delivery_tracking.sql` — `messages.delivered_at`, open tracking. `[R]`
- `0008/0009` provider account, `payment_url`. `[R]`
- `0010_promise_to_pay.sql` — promise columns on runs. `[I]`
- `0011_ai_usage.sql` — AI quota columns. `[R]`
- `0013_reply_intel.sql` — `reply_intel`, `disputes` (+ RLS). `[R]`
- `0014_lemon_billing.sql` / `0015_dodo_billing.sql` — legacy Lemon + Dodo
  subscriptions tables. `[R]`
- `0016_settlements.sql` — `settlement_offers`/`settlement_events` (+ checks,
  status-matrix index). `[R]`
- `0017_paddle_billing.sql` — adds `billing_provider` (default `'dodo'`),
  paddle ids. `[R]`
- `0018_hardening_fixes.sql` — **new**: RLS drop, dedupe + unique index,
  partial active-run index, messages.status, offer tracking columns,
  payment_plan_requests, ladder repair. `[E]`

## `src/lib`

### Scheduler (core, heavily fixed)
- `scheduler/dispatch.ts` — dispatcher + `startRun` + `handleInboundReply`.
  `[R]` `[E]` D05–D11, D14, D02, D24 gates, D06 thread-first.
- `scheduler/inbound.ts` — shared inbound entry (`processInboundReply`,
  `extractThreadHeaders`). `[E]`
- `scheduler/thread-ids.ts` — header token extraction leaf. `[E]`
- `scheduler/dispatch.test.ts` — 11 tests, refactored dispatcher behaviors. `[R]`
- `scheduler/thread-ids.test.ts` — 3 tests. `[E]`

### Billing
- `billing/entitlement.ts` — canonical plan resolution (D14). `[R]` `[E]`
- `billing/plan.ts` — `getPlan`, limits consts (FREE_CLIENT_LIMIT=3,
  FREE_INVOICE_LIMIT=10), grew to re-export `Plan`/`planForSubscription`. `[R]` `[E]`
- `billing/limits.ts` — free/pro limits. `[I]`
- `billing/paddle-events.ts` — rewritten upsert-on-user_id, default-free. `[R]` `[E]`
- `billing/dodo-events.ts` — rewritten same. `[R]` `[E]`
- `billing/reconcile.ts` — reconcile + attach customer ids by user_id. `[R]` `[E]`
- `billing/paddle-events.test.ts` / `dodo-events.test.ts` — rewritten. `[R]` `[E]`
- `billing/entitlement.test.ts` — new. `[E]`

### Recovery / settlement
- `recovery/settlement.ts` — EV engine; D04 (sweep + smallest-beats-wait). `[R]` `[E]`
- `recovery/settlement.test.ts` — 8 tests incl. D04. `[R]` `[E]`
- `recovery/token.ts` — resolution-token HMAC sign/verify. `[R]`
- `recovery/token.test.ts` — 2 tests. `[I]`

### AI
- `ai/draft.ts` — drafting + plan-gated quota, uses entitlement (D14). `[R]` `[E]`
- `ai/quota.ts`, `ai/promise.ts`, `ai/reply.ts`, `ai/providers.ts` (+ tests) — quota,
  promise classification, reply classification, provider rollover. `[I]` (used by dispatch; reply→disputes path unit-covered).

### Analysis
- `analysis/{calculators,forecast,health,next-action,risk}.ts` (+ tests) — debt
  health panels. Pure math, unit-covered. `[I]`

### Integrations
- `integrations/csv.ts` — RFC-4180 parser + alias mapping; amount>0 now. `[R]` `[E]`
- `integrations/provider.ts` — `InboundInvoice` shape. `[I]`
- `integrations/oauth.ts` — OAuth flash/state flow. `[I]`
- `integrations/sync.ts` — provider sync loop. `[I]`
- `integrations/paypal.ts`, `xero.ts`, `stripe.ts`, `stripe-flag.ts` — webhook/
  API wrappers. `[I]` (stripe disabled behind flag).
- `integrations/credentials.ts` — credential store helpers. `[I]`
- `integrations/paid-webhooks.ts` (+test) — provider payment → invoice paid
  reconciliation. `[R]`
- `integrations/csv.test.ts` — 2 tests. `[R]`

### Webhooks
- `webhooks/signatures.ts` — inbound signature check; Svix + legacy + Bearer. `[R]` `[E]`

### Supabase / auth / utils
- `supabase/{admin,server,client,middleware}.ts` — clients. `[I]`
- `auth/{require-user,session,local-session}.ts` — session helpers. `[I]`
- `utils/ratelimit.ts` — in-memory fixed-window limiter + presets. `[R]`
- `utils/format.ts` (+test), `utils/receipt-ticker.ts` — formatting utils. `[I]`
- `db/queries.ts` — all dashboard queries; `getInvoicesWithMeta` now emits
  `paused`. `[R]` `[E]` (+`queries.test.ts`).
- `dodo/{helpers,server,checkout}.ts`, `paddle/{helpers,server,checkout}.ts`
- confirmed cancel fns. `[R]`
- `resend/send.ts` (+test) — outbound send with `resend_message_id`. `[R]`
- `csv/smart-csv.ts` (+test) — AI assisted header mapping. `[I]`
- `calculators/types.ts` — shared tool types. `[I]`
- `seo/{email-templates,tool-calculators}.ts` — marketing content; used by
  template pages (ladder copy aligned). `[I]`

## `src/app` — pages
- `page.tsx` — landing. `[R]` `[E]` LADDER_STEPS `[1,6,7,7]`; FAQ/watch copy
  consistent with data.
- `(app)/invoices/page.tsx` — invoices list (feeds InvoiceTable). `[I]`
- `(app)/dashboard|insights|clients|sequences|settings|tools` pages — dashboards. `[I]`
- `(app)/settings/billing/page.tsx`, `settings/integrations/page.tsx` — billing
  + integrations UI. `[I]`
- `r/[token]/page.tsx` — debtor resolution page. `[R]` `[E]` no status flip, viewed stamp.
- `templates/page.tsx`, `templates/[slug]/page.tsx` — marketing template pages. `[R]` `[E]`
- `login/signup/onboarding/auth/callback` — auth. `[I]`
- `pricing`, `privacy`, `terms`, `refund`, `security` — static. `[I]`
- `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `not-found.tsx`, `error.tsx`,
  layouts — infra. `[I]`

## `src/app/api` — routes (server)
- `cron/dispatch/route.ts` — auth + rate-limited dispatcher; returns `runDispatcher` report. `[R]`
- `invoices/[id]/route.ts` — PATCH (payment_url, pause/resume, status,
  `mark_paid` reconciling) + POST (attach sequence → startRun). `[R]` `[E]`
- `invoices/[id]/send/route.ts` — manual send (`sendRunNow`); WIP preserved
  (failed-status retry + no-active-follow-up copy). `[R]` `[E]`
- `invoices/route.ts` — CRUD. `[I]`
- `r/[token]/pay/route.ts` — new pay-intent. `[E]`
- `r/[token]/resolve/route.ts` — accept/promise/dispute/plan_request. `[R]` `[E]`
- `settlements/approve/route.ts` — owner approves an offer (touches settlement_offers
  status). `[R]` (not modified; reviewed).
- `settlements/recommend/route.ts` — engine wiring. `[I]`
- `account/delete/route.ts` — cancellation of both providers + blocking. `[R]` `[E]`
- `account/export/route.ts` — full data export. `[R]` `[E]`
- `integrations/csv/route.ts` — import w/ counts, cap, quota skip. `[R]` `[E]`
- `webhooks/email/route.ts` — inbound email (svix + legacy + GET verify). `[R]` `[E]`
- `webhooks/resend/route.ts` — Resend inbound + outbound events. `[R]` `[E]`
- `webhooks/{dodo,paddle,paypal,stripe,xero}/route.ts` — provider webhooks. `[I]`
- `billing/*`, `clients`, `sequences`, `integrations/*`, `tools/smart-csv/*`,
  `ai/draft`, `health` — remaining API. `[I]`

## `src/components`
- `settlements/resolution-view.tsx` — debtor card; sends /accept|pay via API. `[R]` `[E]`
- `settlements/settlement-card.tsx`, `settlement-strip.tsx` — owner settlement
  UI (approve/offer list). `[I]` (approve route reviewed)
- `ledger/invoice-table.tsx` — table; Mark paid via PATCH; pause seeded. `[R]` `[E]`
- `ledger/escalation-ladder.tsx`, `sequence-editor.tsx` — ladder visual + editor
  (delay hint "days after last touch" is accurate). `[R]` `[E]`
- `ledger/{aging-strip,urgency-queue,recovery-queue,recovery-steps,receipt-ticker,
  reply-thread,add-client,add-invoice}.tsx` — dashboards. `[I]`
- `billing/{plan-manager,pro-price}.tsx`, `settings/*`, `auth/*`,
  `marketing/*`, `calculators/*`, `tools/*`, `ui/*`, `app-shell/*` — UI. `[I]`

## `src/middleware.ts` / `src/hooks` / `src/types/index.ts`
- middleware — supabase cookie refresh; guard. `[I]`
- types — `Invoice`, `Client`, `Run`, `Sequence`, `SequenceStep`, `Tone`,
  `TONE_META`. `[R]`

## Verdicts
- Sound: analysis math, token HMAC, settlement EV engine (post-D04), rate limiting,
  webhook signature helpers (post-D25), CSV parser.
- Previously broken and fixed on HEAD: see BUG_REPORT.md D02–D20, D24, D25, D27.
- Deferred/verify: D21, D22, D23, D26, D28 (registered in source audit, not in
  this fix set); E2E runner; live-provider smoke tests; live migration apply.