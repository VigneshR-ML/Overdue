# Overdue — Feature Roadmap

Priorities after the UX pass. Each item carries its verification status:
**shipped** (code + tests/typecheck/lint/build) · **designed** (spec) or
**gated** (needs a step we can't do here — live keys, DB migration, browser).

## P0 — shipped this pass

| Feature | Status | Evidence |
|---------|--------|----------|
| Resumable first-invoice onboarding wizard | shipped | `src/app/onboarding/page.tsx`, `src/lib/onboarding/schedule.ts` + 9 tests |
| Per-invoice recovery timeline | shipped | `src/lib/onboarding/timeline.ts` + 7 tests, `/invoices/[invoiceId]` |
| Invoice detail page + settlement anchor + deep links | shipped | route compiled in build |
| Dashboard first-action (no more zeros) + `getClientOptions` | shipped | `getClientOptions` in `queries.ts`, dashboard page |
| Mobile ledger action sheet, confirmations, honest copy | shipped | `invoice-table.tsx` |
| Manual invoice: currency, client picker, no-email draft | shipped | `add-invoice.tsx` / API supports draft |
| Labeled nav (mobile dock + desktop topbar) + `pb-32` | shipped | `dock.tsx`, `topbar.tsx`, layout |
| Settlement: percent control, model-estimate labels, wait baseline | shipped | `settlement-card.tsx` |
| Single-provider billing path, honest plan copy, real quotas | shipped | `plan-manager.tsx`, `limits.ts` |
| Marketing/pricing/insights honesty (no ROI claim, currency note) | shipped | `page.tsx`, `pricing`, `insights` footnote |

## P1 — designed, next

| Feature | Status | Notes |
|---------|--------|-------|
| Per-currency aging/forecast buckets | designed | Replace `getInsights` raw-cent sums with bucket-per-currency or FX-normalisation labelled per bucket; SUSPECTED limitation documented in UX-11 |
| Plain-language "why did the ladder pause?" | designed | Surface `promise_note` / `reply_classification`/ factor list beside each timeline milestone |
| Settlement offer card status on the detail page | designed | Show offer `status` (draft/sent/accepted/expired) on the invoice after approve, not just the resolution link |
| `/tools` landing refresh to match ledger voice | designed | Align with DESIGN_SYSTEM; keep existing tools functional |

## P2 — future

- Industry template editorial variants (auto workshops, agencies, trades) on top
  of the existing 12 template pages.
- Email open/delivery instrumentation surfaced per-message (only where the
  provider truly confirms).
- First-login → first-recovery cohort funnel in product analytics.

## Gated (dev access required; do not unblock in code alone)

| Item | Blocker |
|------|---------|
| Apply migration 0018 to live Supabase (audit G5) | Live DB access |
| Live checkout + email-delivery verification (audit G7) | Live Paddle/Dodo/Resend/provider keys |
| Clear `npm audit` prod findings (audit G12) | `next@16` breaking-major upgrade — schedule separately, then re-run full gate |
| Playwright screenshots + E2E of all P0 screens | Playwright install + browser runtime |