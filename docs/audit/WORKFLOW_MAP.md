# WORKFLOW_MAP.md — every state machine end-to-end

How the product actually runs today (HEAD `f2b3d2c`). Each workflow is traced
from trigger to terminal state, naming the exact files and the state transitions
they enforce. Verified by code read + the unit suites listed per workflow.

Legend: ⚠️ = caveat logged at the bottom.

---

## W1 · Invoice ingestion (manual, CSV, provider sync)

1. **Manual** — `POST /api/invoices` (`src/app/api/invoices/route.ts`): validates
   client email + amount, upserts/locates the client, inserts `invoices`
   (`provider='manual'`, `status='sent'`, `paid_cents=0`, verified `payment_url`)
   under plan caps, then `attachDefaultRuns`.
2. **CSV** — `POST /api/integrations/csv` (`src/app/api/integrations/csv/route.ts`
   + `src/lib/integrations/csv.ts`): RFC-4180 parse → alias-map columns → rows with
   non-finite / `amount <= 0` rejected with row errors → clients resolved via
   `resolveClient` (cached `blockedKeys`); quota-blocked clients skip the invoice
   row (no orphans). Response `{added, updated, errors}`.
3. **Provider sync** — `syncUserProvider` (`src/lib/integrations/sync.ts`):
   xero/stripe token refresh under `withRefreshMutex`, fetch provider invoices,
   upsert clients then invoices keyed `(user_id, provider, provider_id)`
   (idempotent — never wipes a hand-entered `payment_url`), update
   `integrations.last_synced_at`, and `attachDefaultRuns` when any were added.

Terminal: `invoices` row in `sent`/`pending`, a client (or `client_id=null`), and
queued `runs`.

**State machine (invoice):** `pending → sent → overdue → partially_paid → paid`;
`paid` is absorbing (dispatcher, webhooks and PATCH all check `paid_at`/status).

---

## W2 · The escalation ladder (dispatch)

Entry: user action (`Account -> Synced now`, sequence attach, CSV/manual create)
or cron (`POST /api/cron/dispatch`, bearer `CRON_SECRET`).

`runDispatcher` (`src/lib/scheduler/dispatch.ts`):
1. `requeueStaleProcessing()` — claims older than 10 min become `queued`
   (runs BEFORE new work: D11).
2. Batch: pick `queued` runs where `next_run_at <= now`.
3. Plan resolved **once per batch** via `planForSubscription` (D14) → a free user
   only ever gets the polite rungs; pro gets the full authored ladder.
4. `dispatchOne` per run:
   - Reloads sequence steps fresh from `sequences` (edits apply immediately);
     inactive sequence → run `paused`.
   - Loads a live settlement offer (approved/sent/accepted, unexpired) and signs
     a resolution token → embeds the "Resolve for X" button in the email (D02).
   - Neutralise if paid (`paid_at || status=paid || paid>=amount_cents`) →
     run `completed`.
   - Gates: open dispute → pause; pending `payment_plan_requests` → pause.
   - Write-ahead `messages` row `status:'sending'` (D10); send via
     `src/lib/resend/send.ts`; `sent` + `resend_message_id` or `failed`.
     Idempotent per `(run_id, step)` — an existing non-failed message advances
     the ladder without re-sending.
   - `advanceLadder`: offer `approved` stamped `sent` + `delivered_at` + event
     (exactly once); next `next_run_at = due_date + CUMULATIVE_DAYS(steps, nextStep)`
     (D09) or run `completed` at the top.
5. Inbound replies (`src/lib/scheduler/inbound.ts` via webhook routes):
   thread-first match (`In-Reply-To`/`References`, `thread-ids.ts`), then sender
   address within a short window (D06); classifies (promise/dispute/question/
   needs_human); promise → `promise_date` with scheduler; dispute → pause +
   `disputes` row; angry/needs_human → run paused for human reply.

**State machine (run):** `queued → processing → sent → queued… | paused ↔ queued |
completed | cancelled | failed`. `next_run_at` drives the ladder; paused keeps its
schedule; cancelled is terminal (paid / source disconnected / delete).

---

## W3 · Billing / entitlement — one row per user

Providers: Paddle (`src/app/api/webhooks/paddle/route.ts` →
`src/lib/billing/paddle-events.ts`), Dodo (`webhooks/dodo/route.ts` →
`dodo-events.ts`). Webhook routes verify signatures before touching state; each
event deduped via `webhook_events` (`alreadyHandled`).

- All lifecycle events upsert the **single** `subscriptions` row on
  `onConflict:'user_id'` (D15) — no Paddle+Dodo sibling rows.
- `subscription.active/updated/plan_changed/…` → plan from `isProProductId`
  (unknown product = `free`, never pro) + `mapDodoStatus`/Paddle equivalent.
  Transaction events use `subscription_id`.
- `cancelled` with `cancel_at_next_billing_date` keeps Pro until
  `current_period_end` (grace); `subscription.expired/failed` revoke to free.
- `planForSubscription` (`src/lib/billing/entitlement.ts`) is the ONLY place
  "is this user pro?" is decided; `plan.ts`, `ai/draft.ts` quota, and the
  dispatcher all route through it (D14).
- Checkout links come from `src/lib/paddle/checkout.ts` / `src/lib/dodo/checkout.ts`
  with the user/server billing context.

**State machine (subscription row):** `active ↔ paused | on_hold | past_due →
cancelled → expired | failed`; plan: `free ⇄ pro` (verdict from product id/event
type; grace preserved at `current_period_end`).

---

## W4 · Paid detection & reconciliation (the money loop)

Entry | Verify | Effect
------|--------|-------
`webhooks/stripe` `invoice.paid|payment_succeeded` | HMAC + timestamp tolerance | 
`webhooks/paypal` `INVOICING.INVOICE.PAID` | server-to-server verify-webhook-signature | 
`webhooks/xero` INVOICE UPDATE where status=PAID | HMAC, then fetch real status (never optimistic) |
Hourly/sync | (n/a) | `invoices` upserted with provider `status/paid_cents`
Manual | `PATCH /api/invoices/[id] {mark_paid}` | 

All paid paths funnel through the **same** reconciliation
(`src/lib/recovery/paid.ts` `reconcilePaidWork`):
- `invoices.status='paid'`, `paid_at` set; `paid_cents` = provider-sent amount
  (stripe `amount_paid`; paypal `amount.value` major→cents) or the full balance,
  clamped to `amount_cents`.
- `runs` (queued/processing/sent/paused) → `cancelled` — the chase stops.
- `disputes` open → `resolved + resolved_at`.
- `settlement_offers` (approved/sent/accepted) → `paid` + a `paid` event
  (`source` = provider or `manual_mark_paid`).

Webhooks return **500** (not ack) if the flip write errors, so the provider
retries instead of losing the paid signal (D29). `webhook_events` keeps each
provider+event idempotent.

---

## W5 · Smart Settlement

`/api/settlements/recommend` (read-only) → `/api/settlements/approve`
(`src/app/api/settlements/approve/route.ts`, rate-limited, ownership-checked):

1. Validate `offerCents <= outstanding`, `>= minAcceptableCents`, incentive ≤
   `maxIncentiveBps` cap (0..2000); `fee_waiver` demands `feeBasisConfirmed`.
2. Supersede prior approved/sent offers for the invoice (one live offer).
3. Insert `settlement_offers` `status='approved'` + `recommend_meta`, event
   `approved`, return signed `{link, expiresAt}` (capped 14 days).

Delivery: the offer rides the next reminder as a "Resolve for X" button
(W2, D02); the owner card also exposes copy/preview of the link
(`settlement-card.tsx`). The dispatch marks it `sent + delivered_at`.

Debtor side (`src/app/r/[token]/page.tsx`, `src/app/api/r/[token]/resolve/route.ts`,
`POST /api/r/[token]/pay`):
- View → `viewed` event + `viewed_at` (no status flip).
- `accept` → offer `accepted` (+ event) — a commitment, not a charge.
- `dispute` → `disputes` open + runs paused (D05).
- `plan_request` → `payment_plan_requests` row + runs paused (D24).
- `pay` → returns the invoice `payment_url` with the discounted amount, or 409
  letting the debtor know the discounted link is coming (D03); records
  `pay_clicked`.

**State machine (offer):** `approved → sent → accepted → paid` or
`approved/sent/accepted → cancelled` (superseded) / `expired`. `paid` is
terminal and only ever set by a confirmed payment reconciliation (W4).

---

## W6 · Account lifecycle

- **Export** (`/api/account/export`): streams every owned table incl.
  `settlement_offers`, `settlement_events`, `reply_intel`, `disputes`,
  `payment_plan_requests`; `profiles` keyed by PK `id` (D17).
- **Delete** (`/api/account/delete`): cancels **both** Paddle and Dodo
  subscriptions (dynamic import, `isBillingConfigured`); a configured provider
  whose cancel fails **blocks** deletion; unconfigured → warn and continue
  (D16). Then deletes the user's rows (cascade) + vault secrets.

---

## W7 · Tools & marketing (static, deterministic)

- `/tools/smart-csv` two-step `map`→`insights` endpoints (`tools/smart-csv/*`)
  + `smart-csv-importer.tsx`; `src/lib/csv/smart-csv.ts` maps messy headers.
- `/templates/[slug]` + `/tools/[slug]` render SEO content from
  `src/lib/seo/*`; ladder copy `[1,6,7,7]` everywhere (D27).
- `src/middleware.ts`: canonical-host redirect (307) for non-API browser pages;
  Supabase cookie refresh. CSP/HSTS/etc via `next.config.mjs`.

---

## ⚠️ Caveats (accepted or to verify)

1. **Cross-instance sync** (`sync.ts`): the refresh mutex is process-local and
   provider sync is user-triggered (no hourly auto-sync). Upserts are idempotent
   (unique constraint `(user_id, provider, provider_id)`), so no duplicate rows;
   the residual race is a rare concurrent token refresh (one refresh fails,
   self-heals next sync). Consider a DB lease if hourly cross-provider sync is
   ever added.
2. **Offer expiry** only stops the dispatcher carrying the button; an already
   delivered link with an expired token shows the friendly expiry view.
3. **`viewed` events** may double-log on submit retry (no unique constraint);
   analytical only.
4. **Active-run unique index** (`runs_one_active_per_invoice`) is skipped on a
   dirty DB that already has duplicates — confirm at G5.
5. **Playwright** suite is scaffolded but not installed; page flows are covered
   by unit + `tsc`, not a browser (TEST_RESULTS.md G6).