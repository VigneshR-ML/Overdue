# Overdue — Before / After

Narrative account of each user-facing change in this pass. Visual screenshots
are **not** available (no browser/Playwright in this environment — see
`TEST_RESULTS.md`); this table is the code-level before/after, which is
precise and reproducible.

| Surface | Before | After |
|---------|--------|-------|
| **Onboarding** | Single form; an edit wiped the fields below; refresh lost everything; no email harvest; no preview | 5-step resumable wizard persisted to localStorage; inline manual invoice with currency + no-email draft; exact first-email preview; exits only after the `onboarding_completed` write succeeds |
| **Dashboard (new user)** | Grid of zeros + spinner, no path | First-invoice card: Add invoice / Import CSV / Connect, with an honest Free note; "Welcome to the ledger." header |
| **Dashboard (active)** | Static title, single "New ladder" CTA | Dynamic header CTA (Add invoice + Import CSV), up-front "needs attention or done" recovery queue + risk explainer |
| **Ledger table (mobile)** | Hover-only actions, modal dialogs, no confirmations, overstated webhook copy | Per-row "⋯" bottom-sheet action list; `confirm()` on Mark paid / Pause; honest footnote; rows deep-link to the invoice page; paused state survives reload |
| **Invoice detail** | Did not exist (one combined table row) | Full page: overview card (total/paid/owed/due/payment link), recovery timeline (created → recipient → ladder → scheduled/sent → reply/promise → resolved), settlement anchor `#settlement`, reply thread, reminder history |
| **Manual add-invoice** | No currency, no client picker, no drafts, silent double-submit | Currency select; existing-client picker; "no email → save as draft"; validation; single-submit guard; lands on the new invoice |
| **Navigation** | Icon-only mobile dock; no desktop nav | Labeled mobile dock (Home/Invoices/Clients/More + sheet) with safe-area and focus handling; desktop topbar nav (Overview/Invoices/Clients/Ladders/Insights); `pb-32` clearance |
| **Smart Settlement** | bps input jargon; "% today" without "estimate"; no wait baseline; no EV context | Percent input; `est.` labels with expected-value line; explicit "keep the full amount and wait" option; honest model-estimate footnote |
| **Billing / plan** | Dead `ready && ready` branch; "Loading checkout…" that never ended; free list forgot 10-invoice & 5-draft quotas; ROI claim in Pro copy | One provider path (Paddle, Dodo fallback server-side); no dead branch; limits copied from `limits.ts`; honest upgrade copy |
| **Landing / pricing** | "One recovering invoice pays for the year."; FAQ implied autopilot on Free; Paddle-only billing claim | ROI claim removed; FAQ separates Pro autopilot vs Free manual Send-now; billing copy includes Dodo fallback; feature lists match real limits |
| **Insights** | Mixed-currency totals presented as-if-one-currency; "Tightter" typo | Currency footnote added (known limitation documented); typo fixed |

## Residual known gaps (honest)

1. **No browser verification** of the above visuals — worth one Playwright pass.
2. **Mixed-currency insights** still merge raw cents (footnoted; per-currency
   buckets are P1).
3. **Live checkout** unverified (no keys).
4. **Migration 0018** un-applied to the live DB.