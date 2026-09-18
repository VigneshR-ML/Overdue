# Overdue — UI Issue Map

Issue → evidence → fix → file. Where evidence is "code review of `main` @
`7bc91a3` + UX pass changes", the issue is CONFIRMED; live-browser confirmation
for look-and-feel items was not possible (no Playwright in this environment).

## P0 (shipped this pass)

| User-visible symptom | Root cause (code) | Fix (real code, committed) |
|----------------------|-------------------|----------------------------|
| Refresh during onboarding loses your name/invoice | Single-step `<form>`; nothing persisted | 5-step wizard, `localStorage:overdue:onboarding:<userId>`, `src/app/onboarding/page.tsx` |
| First-time dashboard is zeros and a spinner | `EmptyState` only for overdue==0; no invoice==0 branch | First-invoice setup card + dynamic CTA, `src/app/(app)/dashboard/page.tsx` |
| Can't tell what the ladder did for one invoice | One combined table row, no per-invoice read model | Detail page `/invoices/[invoiceId]` + pure `buildInvoiceTimeline` (`src/lib/onboarding/timeline.ts`) |
| Mark paid surprises owners on mobile | Hover-only row actions, no confirm | Action sheet + `confirm()`, honest footnote, `src/components/ledger/invoice-table.tsx` |
| No currency choice when adding an invoice | Hard-coded USD assumptions in the form | `CURRENCIES` select, `src/components/ledger/add-invoice.tsx` |
| Reminder states claimed but impossible (no client email) | Invoice saved without email; UI implied sending | Draft checkbox + blocker states in form/invoice-table/timeline |
| Settlement controls in "bps" jargon | Raw basis-points input | Percent input + model-estimate labels + wait baseline, `src/components/settlements/settlement-card.tsx` |
| Checkout button "loading" forever + dual-provider confusion | `ready = paddle.ready && dodo.ready` (both always true); dead loading branch | Single provider path, `src/components/billing/plan-manager.tsx` |
| "Pays for the year" ROI claim on landing/pricing | Marketing copy, unbacked | Removed, honest framing + real Free quotas, `src/app/page.tsx`, `src/app/pricing/page.tsx` |
| No labels on mobile nav | Icon-only dock | Labeled dock + More sheet, `src/components/app-shell/dock.tsx` |

## Deferred (tracked, not shipped)

| Symptom | Root cause | Plan |
|---------|-----------|------|
| Mixed-currency ledgers sum into one bucket | `getInsights` sums `amount_cents` without currency | Per-currency buckets or FX-normalisation + explanation (FEATURE_ROADMAP) |
| Visual snapshots of every screen | No browser tooling in env | Add Playwright + capture BEFORE/AFTER (see TEST_RESULTS) |
| Industry-specific template variants | Templates are generic-but-real (12 SEO pages) | Editorial variants per vertical, P2 |