# Overdue — UI/UX Audit (BIG PICKLE redesign pass)

Audit of the live UI against the warm-paper editorial "Ledger" identity and the
priority-first-goal: getting a user from first login to their first **successfully
followed-up** invoice. Every item is tagged **CONFIRMED** (seen in code/DB),
**SUSPECTED** (needs a live browser/data check), or **IMPROVEMENT**.

Severity: **1** = blocks the first-invoice journey / payment · **2** = material
clarity or trust issue · **3** = polish.

## P0 — first-invoice journey (drives conversion)

| ID | Area | Finding | Status | Severity | Fix | Done |
|----|------|---------|--------|----------|-----|------|
| UX-01 | Onboarding | Was a single page; typing an identity step overwrote everything below and a mid-flow refresh lost all progress. No client-email harvest, so reminders were dead on arrival. | CONFIRMED | 1 | Resumable 5-step wizard (identity → invoice → schedule → preview → done), step persisted in `localStorage:overdue:onboarding:<userId>`, inline manual invoice with currency + no-email draft handling, exact-email preview, `onboarding_completed` server write checked before navigation. Backed by pure helpers in `src/lib/onboarding/*` (16 new unit tests). | Yes |
| UX-02 | Nav / IA | Mobile nav was an icon-only bar with no labels ("Home," "Ladders," "Insights" guessed); desktop had no global nav — the ledger was one deep scroll. | CONFIRMED | 1 | Mobile dock with labels + "More" sheet; desktop topbar nav (Overview / Invoices / Clients / Ladders / Insights), `aria-current`, safe-area + `pb-32` clearance. | Yes |
| UX-03 | Ledger table | Row actions were invisible until hover and modal-only; Mark paid / Pause fired with no confirmation; copy claimed a webhook that doesn't exist ("auto-updates the next time your invoicing source syncs") — a trust bug. | CONFIRMED | 1 | Per-row "⋯" mobile action sheet; `confirm()` on irreversible Mark paid / Pause; honest footnote ("marking paid records the payment, stops the ladder, settles open offer/dispute"); paused seeds from server `paused` so reloads stay truthful. Rows link to the new detail page. | Yes |
| UX-04 | Dashboard empty state | A brand-new account rendered a grid of zeros and a spinner — no path, no next action. | CONFIRMED | 1 | First-invoice card with three worked pathways (Add invoice / Import CSV / Connect) and a Free-honest note ("nothing sends on Free until you press Send now"); dynamic header CTA wired with real `getClientOptions`. Needs one browser pass (blocked — Playwright absent). | Yes |
| UX-05 | Per-invoice timeline | No way to see what the ladder *did* for one invoice — status lived in one table row. | CONFIRMED | 2 | New `buildInvoiceTimeline` (pure, tested — 7 tests) only claims states the DB proves (created/scheduled/sent/reply/resolved), surfaces "no client email" and paused as blockers, never "opens" without `opened_at`. | Yes |
| UX-06 | Deep links | "Send now / settle" in the table were places, not addresses. | CONFIRMED | 2 | Invoice detail route `/invoices/[invoiceId]` with `#settlement` anchor, `?focus=` deep link to the ledger, correct Back. | Yes |
| UX-07 | Manual invoice form | No currency selector (everything tentatively USD); no way to draft an invoice without an email; picking an existing client meant typing their name by hand. | CONFIRMED | 1 | Currency select (`CURRENCIES`), existing-client picker from `getClientOptions`, validation, "no email → saving as draft" checkbox, duplicate-submit guard, lands on the new invoice's detail page on success. | Yes |

## P0 — integrity & money (trust)

| ID | Area | Finding | Status | Severity | Fix | Done |
|----|------|---------|--------|----------|-----|------|
| UX-08 | Settlement card | Incentive input was **basis points** shown to a non-technical owner; probability shown as plain "% today" without signalling it's a model estimate; no baseline "wait" option rendered, so the owner could never see "do nothing is better." | CONFIRMED | 2 | Percent input ("Max incentive (% of invoice)"), every option labeled `est.` with expected-value line, explicit "keep the full amount and wait" baseline option, and an honest footnote ("an expectation, not a promise"). | Yes |
| UX-09 | Pro billing block | `ready = paddle.ready && dodo.ready` was dead code — both hooks return `ready: true` unconditionally, so the checkout button was never actually disabled; dead "Loading checkout…" branch; Free feature list omitted the real quotas (10 invoices, 5 AI drafts). | CONFIRMED | 2 | Single-provider path via `usePaddleCheckout` (server route still falls back to Dodo); dead `ready` branch removed; Free/Pro lists now quote the real limits from `src/lib/billing/limits.ts`; "one recovered invoice pays for the year" ROI claim removed. | Yes |
| UX-10 | Pricing / landing | "One recovering invoice pays for the year." is an unbacked ROI claim; FAQ said autopilot on day one for everyone (autopilot is Pro-gated); billing copy named only Paddle though Dodo fallback exists on some deploys. | CONFIRMED | 2 | Removed ROI claim on landing + pricing; FAQ now differentiates Pro autopilot vs Free manual "Send now"; billing copy mentions the Dodo fallback; feature lists updated to real limits. | Yes |
| UX-11 | Insights currency | Aging buckets, DSO and cash forecast sum `amount_cents` across currencies in one bucket labelled USD-by-default — a mixed-currency ledger shows silently merged totals. | SUSPECTED | 2 | Honest footnote on the Insights page + documented as a **known limitation** (see FEATURE_ROADMAP: per-currency buckets). Verify with a live mixed-currency account before claiming coverage. | Yes (footnote) / No (per-currency) |

## P1 / P2 — deferred (with reasons)

| ID | Area | Finding | Status | Severity | Note |
|----|------|---------|--------|----------|------|
| UX-07b | Industry mail templates | Real per-industry template variants wanted (e.g. auto workshops, agencies). | IMPROVEMENT | 3 | `src/app/templates/[slug]` already ships 12 SEO templates; defer editorial variants, keep the shape. |
| UX-12 | Error / empty states | Route loading + error boundaries already exist (`(app)/loading.tsx`, `(app)/error.tsx` → `ErrorLedger`). Dashboard + ledger empties were the gap and are covered by UX-04/UX-03. | CONFIRMED | 3 | Remaining cadence review (offline states, CRUD failures) in P2. |
| UX-13 | AI transparency | Reply-thread confidence/source labels and explainable risk scores already render (CONFIRMED good). Add a plain-language "why did it pause?" line in P2. | IMPROVEMENT | 3 | |

## Blocked / not executable in this environment

- **Screenshots & E2E**: Playwright is not installed; no browser renders were
  captured. Any claim of visual state is from code review only. See
  `TEST_RESULTS.md` for what was and wasn't run.
- **Migration 0018** (audit G5) is not applied to the live Supabase — live
  DB-shape guarantees rest on schema parity review only.
- **Live provider keys** (Paddle/Dodo/Resend/PayPal/Xero) absent — checkout and
  email-delivery paths verified by code + unit tests, not live calls.
- **`next@16` upgrade** (audit G12) is required to clear the prod audit findings;
  it is a breaking-major upgrade and stays gated.