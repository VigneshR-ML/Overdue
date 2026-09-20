# FIX_CHANGELOG.md — what changed, and where

## Reanalysis pass — 2026-09-20

- Added migration `0019_api_write_boundary.sql`: authenticated clients keep
  owner-scoped reads but cannot bypass API validation, quotas, reconciliation,
  or scheduler state transitions with direct Data API writes. Trusted writes
  now use the server-only service role after explicit ownership checks.
- Bound Stripe/Xero OAuth callbacks to the currently signed-in user; future-
  dated and expired state tokens are rejected and unit-tested.
- Canonicalized and validated sequence JSON (bounds, tones, required copy,
  ordering, field allowlist) before storage.
- Made calendar-date calculations UTC-stable across forecasting, scheduling,
  settlement, invoice, and display paths; added cross-timezone verification.
- Hardened invoice paid/partial-paid transitions and made settlement resolve
  actions idempotent with mutation-error handling and duplicate suppression.
- Upgraded Next.js to 16.3.5, React to 19.3.0, ESLint to 9, and Vitest to 5;
  migrated middleware to Proxy and async request APIs. `npm audit` is now zero.
- Bundled Figtree, Fraunces, and IBM Plex Mono so production builds are network-
  independent; updated CSP for Vercel telemetry.
- Browser smoke found and fixed a public-page crash when Supabase env vars are
  absent; five public routes now render without a framework overlay.
- Current evidence: 217/217 tests, lint/typecheck/build green, full audit clean.

Hardening pass: committed as `f2b3d2c` on top of pinned `d005e34e` (41 files,
+1743/−395). Master pass (this audit) adds the changes below on top of
`f2b3d2c`, uncommitted. Baseline before this pass: 193 tests. Current:
**197 tests passing**, `tsc --noEmit` clean, `npx next lint` clean,
`npm run build` green.

## Master-pass additions (D29–D32)

### Paid webhooks now record real amounts and reconcile the chase (D29)
- `src/lib/integrations/paid-webhooks.ts` — `markInvoicePaid` now returns
  `{ flipped, error }` (error only when the write failed, so callers can refuse
  to acknowledge), accepts `opts.paidCents` (clamped to `amount_cents`), and
  invokes `reconcilePaidWork` on a real flip.
- `[NEW] src/lib/recovery/paid.ts` — shared `reconcilePaidWork`: runs
  (queued/processing/sent/paused) → `cancelled`; open disputes → `resolved`;
  open settlement offers → `paid` + `settlement_events` `paid` rows.
- `src/app/api/invoices/[id]/route.ts` — `mark_paid` PATCH now calls the same
  `reconcilePaidWork` (single source of truth).
- `webhooks/{stripe,paypal,xero}/route.ts` — pass the provider's authoritative
  amount (`amount_paid`; PayPal string `amount.value` → cents) and return
  **500** instead of acknowledging when the flip write errors, so the provider
  retries and the paid signal is never lost.

### Settlement card copy/clipboard (D30)
- `src/components/settlements/settlement-card.tsx` — copy link awaits the
  clipboard write (with textarea fallback) before confirming; expiry line
  renders the actual `expiresAt` instead of hard-coded "expires tonight".

### Client email validation (D31)
- `src/app/api/clients/route.ts` — rejects malformed `billing_email` on create
  (prevents hard-bouncing reminder rungs).

### AI prompt hardening (D32)
- `src/lib/ai/draft.ts` — system prompt treats the FACTS / CURRENT DRAFT blocks
  as untrusted data and forbids following any instruction embedded in them.

### Docs
- `docs/audit/WORKFLOW_MAP.md` — new; W1–W7 state machines end-to-end.
- `docs/audit/COMPLETE_FILE_AUDIT.md` — per-file table reconciling all tracked
  files. `BUG_REPORT.md` / `TEST_RESULTS.md` / `LAUNCH_READINESS.md` updated.

## Schema — `supabase/migrations/0018_hardening_fixes.sql` (new, additive)

| Change | Defect |
|--------|--------|
| `drop policy if exists "subs_all_own"` on `subscriptions` (leaves `subs_select_own`) | D13 |
| Dedupe subscriptions (paddle-bound > dodo-bound > `plan='pro'` > newest) then `create unique index subscriptions_user_uidx on subscriptions(user_id)` | D15 |
| Partial unique index `runs_one_active_per_invoice on runs(invoice_id) where status in ('queued','processing','sent','paused')` — guarded in a `DO` block so existing dev duplicates don't abort the migration (if your dev DB already has dupes the index is intentionally skipped; dedupe manually) | D08 |
| `settlement_offers` `+ delivered_at`, `+ viewed_at timestamptz` | D02 |
| `messages` `+ status text not null default 'sent' check (status in ('sending','sent','failed'))`; `idx_messages_run_step`, `idx_messages_resend_message_id` | D10 |
| New `payment_plan_requests` table + RLS `payment_plan_select_own` / `payment_plan_all_own`, anon grants revoked | D24 |
| Data update: for default ladders matching gentle@1 + nudge@7 + exactly 4 steps, rebuilds `steps` with nudge `delay_days` 6 | D09 |

`0001_init.sql` seeds updated in place: Standard Ladder `[1,7,7,7]` → `[1,6,7,7]`
in both the `on_auth_user_created` trigger seed and template id `...0001`
(description string updated to "six days of silence between each touch").

## Scheduler / dispatch — `src/lib/scheduler/dispatch.ts`

- `requeueStaleProcessing()` moved to the top of `runDispatcher()` so stale
  `processing` claims are recovered before new batches are selected (D11).
- `dispatchOne` now: pre-inserts a `messages` row with `status:'sending'`;
  skips (advances the ladder) if a non-`failed` message already exists for
  `(run_id, step)`; updates the row to `sent`+`resend_message_id` on success or
  `failed` on error (D10); `nextRunAt = dueDate + CUMULATIVE_DAYS(steps, nextStep)`
  so falls back to the real cumulative schedule (D09); offer updates stamp
  `status:'sent', delivered_at` (D02); new gates pause a run when an open
  dispute exists or a pending `payment_plan_requests` row is present (D05/D24).
- Run's start/advance no longer repeats the plan lookup per run — resolved
  by `planForSubscription` once per batch (D14).
- `startRun` rewritten: select-first; skip when a non-completed run exists;
  error when the invoice is already completed; plain insert; `23505` → clear
  "invoice already has an active ladder run" error (D07/D08).
- `handleInboundReply(clientAddress, text?, opts)` takes `{ inReplyTo, references }`
  and matches thread-first via `extractMessageIdTokens` before falling back to
  address matching (D06).

New leaf modules (avoid circular imports):
- `src/lib/scheduler/thread-ids.ts` — `extractMessageIdTokens(...headers)`.
- `src/lib/scheduler/inbound.ts` — `processInboundReply`, `extractThreadHeaders`,
  re-exports `extractMessageIdTokens`.

## Billing / entitlement

- New `src/lib/billing/entitlement.ts` — `planForSubscription`, `graceUntil`,
  `Plan`. Cancelled keeps Pro through `current_period_end`; failed/expired revoke
  instantly; unknown statuses keep Pro (retry windows). (D14)
- `src/lib/billing/plan.ts` — `getPlan` routes through `planForSubscription`;
  `src/lib/ai/draft.ts` `checkAiQuota` / `markAiQuotaUsed` use it too (D14).
- `paddle-events.ts`, `dodo-events.ts` rewritten to a single-row upsert on
  `{ onConflict: "user_id" }` with `billing_provider` set, removing the
  attach-then-update dance and sibling-row deletes (D15). Transaction events
  use `data.subscription_id` (not the transaction id) as the sub id. Unknown
  product + no prior grant now resolves to **free**, not pro.
- `reconcile.ts` upserts and `attachDodo/PaddleCustomerId` operate directly on
  `user_id` (D15).

## Billing / account lifecycle

- `src/app/api/account/delete/route.ts` — cancels BOTH Paddle and Dodo before
  deleting the user; a configured provider that fails to cancel blocks deletion
  (D16).
- `src/app/api/account/export/route.ts` — profiles queried by PK `id`; adds
  `settlement_offers`, `settlement_events`, `reply_intel`, `disputes`,
  `payment_plan_requests` (D17).

## Settlements

- `src/lib/recovery/settlement.ts` — candidate incentives swept across the
  merchant's allowed range up to and including `maxIncentiveBps`; single `wait`
  baseline; recommendation = smallest incentive that beats waiting (D04).
- New `src/app/api/r/[token]/pay/route.ts` — verified-token, rate-limited pay
  intent: returns discounted payment URL or, when the invoice has none, a clear
  409 telling the debtor the discounted amount stands (D03).
- `src/components/settlements/resolution-view.tsx` — accepted state pays through
  `POST /pay` instead of linking to the full-price URL; renders discounted
  amount + "not the original balance" messaging (D03).
- `src/app/api/r/[token]/resolve/route.ts` — `dispute` pauses runs; new
  `plan_request` action inserts a `payment_plan_requests` row and pauses runs
  (D05/D24).
- `src/app/r/[token]/page.tsx` — view stamps `viewed_at` and settles `viewed`;
  removes the false approved→sent flip (D02).

## Ledger / CSV

- `src/app/api/invoices/[id]/route.ts` PATCH — `mark_paid` reconciles:
  `paid_cents` defaults to `amount_cents`, live runs → `cancelled`, open
  disputes → `resolved`, open settlement offers → `paid` with a `paid` event
  (D19).
- `src/components/ledger/invoice-table.tsx` — Mark paid calls the server PATCH;
  pause toggle seeds from the server-run `paused` flag and re-syncs with the
  `invoices` prop (D19/D20).
- `src/lib/db/queries.ts` `getInvoicesWithMeta` returns a computed `paused`
  boolean from nested `runs(status)` (D20).
- `src/lib/integrations/csv.ts` — non-positive amounts rejected with a row error
  (D18).
- `src/app/api/integrations/csv/route.ts` — accurate added/updated counts (pre-
  find of existing `provider_id`s); over-quota client rows are skipped, not
  inserted as orphans; blocked keys cached per import (D18).

## Webhooks / security / ops

- `src/lib/webhooks/signatures.ts` — `verifyInboundReplySignature` accepts
  Svix `v1,<b64>` (HMAC over `svixId + '.' + svixTimestamp + '.' + rawBody`),
  legacy `t=,v1=hex`, and Bearer (D25).
- `src/app/api/webhooks/email/route.ts` — adds `GET` (Svix endpoint verify),
  passes svix-id/svix-timestamp, probes array-style `From` headers, threads
  import (D25/D06).
- `src/app/api/webhooks/resend/route.ts` — handles Resend `email.received`
  inbound through `processInboundReply` (D06).
- `.github/workflows/dispatch.yml` — captures the endpoint response, prints it,
  fails the run on non-200 or a JSON body without `"ok":true` (D12).

## Copy consistency (D27)

- `src/app/page.tsx` `LADDER_STEPS` nudge delay 7 → 6.
- `src/app/templates/[slug]/page.tsx` ladder nudge delay 7 → 6 (matches the
  "day 1, 7, 14, 21" copy and the actual default).
- `src/components/ledger/escalation-ladder.tsx` empty-state fallback `[1,7,7,7]`
  → `[1,6,7,7]`.
- README ladder line already matches `day 1 → 7 → 14 → 21` once the data is
  fixed; no further copy drift found.

## Tests added/updated

- `src/lib/billing/paddle-events.test.ts` — rewrote to upsert-on-`user_id`
  semantics (created/preserve/statuses/transaction sub id/default-free/past_due/
  trialing/unhandled).
- `src/lib/billing/dodo-events.test.ts` — same rewrite for Dodo.
- `src/lib/recovery/settlement.test.ts` — off-grid maxBps + single-baseline test.
- New `src/lib/billing/entitlement.test.ts`, `src/lib/scheduler/thread-ids.test.ts`
  cover `planForSubscription`/`graceUntil` and thread-header extraction.
- `src/lib/integrations/paid-webhooks.test.ts` — rewritten for the D29 API:
  default full-amount flip, provider-sent amount clamped to balance, reconcile
  on flip / skip when already paid, write-error surfacing, unscoped/no-invoice
  no-ops. (17 tests; suite total 197 on 24 files.)
