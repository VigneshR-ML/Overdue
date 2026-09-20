# BUG_REPORT.md — Overdue pre-launch defect audit

Audit base: commit `d005e34e62628cb2217c515552ffdda9cd153e0b` (pinned)
Master-pass HEAD: commit `f2b3d2c` (recorded this pass)
Repo: `VigneshR-ML/Overdue` · Reviewed at `/home/leodas/mvp/overdue`

Below is the consolidated defect register for the 28 items identified during the
two-pass audit (code read + subagent exploration) plus the 4 found in the
master-pass re-read (D29–D32), each tracked to the fix. Items marked **Fixed**
address the identified root cause on `HEAD`. Items marked **Verify against source
audit** are defects whose source-level reproduction was not carried into the
hard-fix set — the audit notes still apply; crossing them off the launch
checklist requires the E2E/live check described in `LAUNCH_READINESS.md`.

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
| D29 | Med | paid webhooks / ledger | Provider payment webhooks flipped `invoices.status` to paid but recorded no `paid_cents` (amounts silently diverged) and did not reconcile runs/disputes/offers; on a DB write failure the event was recorded and acknowledged anyway, losing the paid signal for good. | **Fixed** — `markInvoicePaid` takes the provider's authoritative amount (Stripe `amount_paid`, PayPal `amount.value` major→cents, Xero full) clamped to the balance and drives the shared `reconcilePaidWork` (runs→cancelled, disputes→resolved, offers→paid + events). Webhooks now return **500** (no ack) when the flip write errors so the provider retries. Shared helper `src/lib/recovery/paid.ts` used by the manual `mark_paid` PATCH too. |
| D30 | Low | settlements UI | "Copy link" shown "Copied" even when clipboard write failed/denied; expiry label hard-coded "expires tonight" regardless of the real (up-to-14-day) offer window. | **Fixed** — copy awaits `navigator.clipboard` with a fallback and only then confirms; expiry renders from the returned `expiresAt` (`today at <t>` or a date). |
| D31 | Med | data quality / outbound | Creating a client accepted any string as `billing_email`, so a malformed address would hard-bounce every reminder rung. | **Fixed** — email format validated on `POST /api/clients` (same regex the invoice path uses). |
| D32 | Low | AI security | LLM drafts embed client-supplied facts (name, number, notes) unquoted in the prompt — a hostile client name could carry prompt-injection text into a draft the owner might send. | **Fixed** — system prompt now marks the FACTS/CURRENT DRAFT blocks as untrusted data and forbids following instructions inside them. Low severity: drafts stay owner-reviewed, but the guard is cheap. |

## Reanalysis addendum — 2026-09-20

| ID | Severity | Area | Root cause (as found) | Status |
|----|----------|------|----------------------|--------|
| D33 | Cri | authorization | Broad authenticated write grants/policies let owners bypass API quotas, validation and business state transitions through the public Data API. | **Fixed in code** — 0019 removes write policies/grants; server routes use service role with owner filters. **Apply/verify live.** |
| D34 | Hi | OAuth | Signed state identified a user but callbacks were not bound to the browser's current session; future timestamps were also accepted. | **Fixed** — callback session/user match plus bounded state age tests. |
| D35 | Hi | ladders | Sequence payloads accepted arbitrary fields and malformed steps on create; update silently coerced invalid values. | **Fixed** — shared strict canonical validator and tests. |
| D36 | Hi | dates | Date-only invoice and forecast calculations mixed local time, noon offsets and server timezone, changing results by deployment TZ. | **Fixed** — shared UTC calendar helpers and cross-timezone test runs. |
| D37 | Hi | state transitions | `status:'paid'` could bypass reconciliation; partial-paid amounts were weakly checked; public resolution actions duplicated rows and ignored write failures. | **Fixed** — canonical paid/partial rules, reconciliation, idempotency and explicit mutation errors. |
| D38 | Cri | dependencies | Next 14/PostCSS and the old Vitest/Vite chain carried critical/high/moderate advisories. | **Fixed** — Next 16/React 19/Vitest 5 migration; full `npm audit` is zero. |
| D39 | Hi | runtime | Root auth handler constructed a Supabase client without configuration, crashing every public page on fresh/unconfigured previews. | **Fixed** — handler now no-ops until public Supabase settings exist; browser verified. |
| D40 | Med | build | Production build fetched Google Fonts and failed in restricted/offline builders. | **Fixed** — fonts bundled from Fontsource packages. |
| D41 | Low | observability | CSP blocked the Vercel Analytics and Speed Insights loader. | **Fixed** — telemetry script origin added to CSP. |
| D42 | Low | responsive UI | Footer email produced a small horizontal overflow at tablet width. | **Fixed** — long address can wrap. |

37 of 42 registered defects are fixed on `HEAD`. The 5 historical placeholders — D21/D22/D23/D26/D28 —
are registered in the prior source audit but their source-level reproduction was
not carried into the hard-fix set; close them against the original audit before
treating the register as finished (LAUNCH_READINESS G1). See `FIX_CHANGELOG.md`
for the concrete changes and `TEST_RESULTS.md` for the evidence.
