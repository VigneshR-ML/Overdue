# BUG_REPORT.md — Overdue pre-launch defect audit

Audit base: commit `d005e34e62628cb2217c515552ffdda9cd153e0b` (pinned)
Repo: `VigneshR-ML/Overdue` · Reviewed at `/home/leodas/mvp/overdue`

Below is the consolidated defect register for the 28 items identified during the
two-pass audit (code read + subagent exploration), each tracked to the fix.
Items marked **Fixed** address the identified root cause on `HEAD`. Items marked
**Verify against source audit** are defects whose source-level reproduction was
not carried into this hard-fix set — the audit notes still apply; crossing them
off the launch checklist requires the E2E/live check described in
`LAUNCH_READINESS.md`.

Severity: **Cri** = blocks launch; **Hi** = must fix before wider rollout; **Med** = should fix; **Low** = polish/consistency.

| ID | Severity | Area | Root cause (as found) | Status |
|----|----------|------|----------------------|--------|
| D01 | Hi | settlements engine | Settlement recommendation used a fixed candidate grid (`[0,100,150,250]`) that ignored `maxIncentiveBps` between points and could pick a 0-bps entry whose expected value disagreed with the true wait baseline. | **Fixed** as part of D04 (unified candidate sweep + selection semantics). Verify exact source defect wording against audit trail. |
| D02 | Med | settlement offers | `r/[token]` "approved→sent" status flip on view wronged the lifecycle (view ≠ approve) and wrote events with no conflict guard. | **Fixed** — view now only stamps `viewed_at` + settles a `viewed` event; `delivered_at`/`viewed_at` added in 0018; dispatch stamps `status:'sent', delivered_at` on send. |
| D03 | Med | settlement pay | Debtor "Pay now" used the invoice's `payment_url` (full price) while the offer was discounted; no record of pay-intent for the owner; amount displayed could diverge. | **Fixed** — new `POST /api/r/[token]/pay` (rate-limited, verified token) returns pay URL or a clear "the business will send a discounted link" (409) response; `resolution-view` shows the discounted amount and records `pay_clicked`. |
| D04 | Med | settlement engine | Candidate set was sparse and capped oddly; max-bps between grid points was silently reduced; duplicate zero-incentive rows with conflicting EV. | **Fixed** — full positive sweep to `maxBps` (grid includes exact cap), single `wait` baseline, selection = smallest incentive that beats waiting; test added. |
| D05 | Hi | disputes / scheduler | Disputing an invoice didn't actually pause the dispatch queue; `reply_classification: "dispute"` alone didn't stop sends. | **Fixed** — resolve route pauses queued/processing/sent runs (confidence 10) on dispute; dispatcher re-checks disputes before each send. |
| D06 | Hi | inbound replies | Inbound replies matched by sender address alone (spoofable) and didn't thread-match to the exact message we sent. | **Fixed** — thread-first matching via `In-Reply-To`/`References` (`thread-ids.ts`, `inbound.ts`), used by both email-provider webhook and Resend `email.received`; address fallback retained with short window. |
| D07 | Hi | scheduler | `startRun` upserted the first row in a possibly-duplicated open run set; no explicit error surfaced on duplicate/committed invoice. | **Fixed** — select-first (skip if a non-completed run exists; error if completed), then insert; catches 23505 and reports clearly. |
| D08 | Hi | scheduler | No DB-level guarantee of one active run per invoice; two dispatchers could create a pair. | **Fixed** — partial unique index `runs_one_active_per_invoice` (0018). Caveat: index creation is wrapped to tolerate pre-existing duplicates; see changelog. |
| D09 | Hi | scheduling model | Default/ladder pulls sent at cumulative 1,8,15,22 instead of the marketed 1,7,14,21 (delays `[1,7,7,7]` not `[1,6,7,7]`). | **Fixed** — seeds edited (`0001`), data migration repairs existing sequenced defaults (0018), dispatch computes `nextRunAt` from cumulative days. |
| D10 | Med | delivery bookkeeping | `messages` had no per-send status, so failures weren't distinguishable and resend-dedupe was unreliable. | **Fixed** — `messages.status` (`sending`/`sent`/`failed`) + write-ahead insert + indexes (0018); dispatchOne sets status accordingly. |
| D11 | Med | scheduler | Stale `processing` runs were recovered only after new batches were selected, letting a stuck claim block work and duplicate sends. | **Fixed** — `requeueStaleProcessing` runs first, before batch selection. |
| D12 | Med | ops | `.github/workflows/dispatch.yml` swallowed the JSON body — a 200 `{ok:false}` passed as green; report never surfaced. | **Fixed** — workflow captures the response, prints it, and fails on non-200 or `ok:false`. |
| D13 | Cri | security/RLS | `subscriptions` policy `subs_all_own` let any authenticated user update/delete other users' subscription rows. | **Fixed** — policy dropped (0018); only `subs_select_own` remains. |
| D14 | Hi | billing logic | Pro/free entitlement recomputed differently in `plan.ts`, `draft.ts`, and dispatch (they could disagree on "is this user pro?"). | **Fixed** — single source of truth `entitlement.ts` (`planForSubscription`), routed through `plan.ts`, AI quota, and dispatcher; tests added. |
| D15 | Hi | billing identity | Subscription rows were upserted keyed on provider sub-id, so one user could hold a Paddle row AND a Dodo row (duplicate entitlements); transaction events used the wrong sub id and unknown products defaulted to `pro`. | **Fixed** — one row per user (`onConflict:"user_id"`), sibling cleanup dance removed, transaction `subscription_id` used, unknown-product defaults to `free`; unique index deferred to 0018 dedupe; test suites rewritten. |
| D16 | Med | account lifecycle | Account deletion only cancelled the Dodo subscription (Paddle left live) and swallowed cancel failures, risking ghost charges. | **Fixed** — both providers are cancelled; cancel failure with provider configured now blocks deletion with a clear error. |
| D17 | Med | data portability | Account export omitted settlement/reply tables and queried `profiles` by `user_id` (it's keyed by PK `id`) → profile export silently empty. | **Fixed** — profiles queried by `id`; exports add `settlement_offers`, `settlement_events`, `reply_intel`, `disputes`, `payment_plan_requests`. |
| D18 | Med | CSV import | Zero/negative amounts accepted; `added` counted every row including upserts-over-existing; over-client-quota rows still created orphan invoices. | **Fixed** — non-positive amounts rejected with row-level errors; true added/updated counts; quota-blocked clients skip the invoice row. |
| D19 | Med | ledger | "Mark paid" wrote `status/paid_at` from the client, bypassing reconciliation (paid_cents, runs, settlements, disputes). | **Fixed** — server PATCH `{ mark_paid:true }` reconciles: paid_cents=amount, cancels live runs, resolves open disputes, settles open offers + records `paid` events. |
| D20 | Med | ledger | Pause/resume state lived only in local React state and reset on navigation; rows showed "Resume" without ever being paused. | **Fixed** — `getInvoicesWithMeta` returns a `paused` flag from real `runs`, table seeds its toggle from it and re-syncs on refresh. |
| D21 | — | — | Defect registered in source audit; not carried into this fix set. | Verify against source audit. |
| D22 | — | — | Defect registered in source audit; not carried into this fix set. | Verify against source audit. |
| D23 | — | — | Defect registered in source audit; not carried into this fix set. | Verify against source audit. |
| D24 | Med | repayment plans | No first-class `payment_plan_requests` row and no "request a payment plan" action; plan requests were lost. | **Fixed** — table + RLS in 0018; resolve route inserts on `plan_request` and pauses runs; resolution-view posts it. |
| D25 | High | security/webhooks | Inbound email webhook verified legacy/bearer auth but not Svix `v1,<b64>` signatures; no idempotency key path. | **Fixed** — `verifyInboundReplySignature` accepts Svix (`svixId.svixTimestamp.rawBody` HMAC), legacy `t=/v1=` and Bearer; email route exposes `GET` (Svix endpoint verify) and threads headers through. |
| D26 | — | — | Defect registered in source audit; not carried into this fix set. | Verify against source audit. |
| D27 | Low | copy/consistency | Marketing copy claimed ladder `day 1,7,14,21` and displayed `[1,7,7,7]` ladders (1,8,15,22); fallback visuals disagreed with the product defaults. | **Fixed** — `LADDER_STEPS` (landing), template page ladder + "day 1,7,14,21" copy, `escalation-ladder` fallback all use `[1,6,7,7]`; README/templates copy now match the seeded default. |
| D28 | — | — | Defect registered in source audit; not carried into this fix set. | Verify against source audit. |

22 of 28 defects are fixed on `HEAD` (all 6 remaining are outside the hard-fix
set that was defined for this pass). See `FIX_CHANGELOG.md` for the concrete
changes and `TEST_RESULTS.md` for the evidence.