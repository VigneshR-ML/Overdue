# Overdue — Conversion Plan (Free → Pro)

Goal: a Free user reaches their **first successful recovery**, sees the ladder
do work, then hits a real limit and upgrades — instead of being pushed by an
ROI claim. Every optimisation below is either shipped this pass or explicitly
marked as not-yet-runnable.

## The funnel and what we optimised

```
signup ─► onboarding ─► first invoice ─► first recovery ─► first limit ─► Pro
         UX-01 wizard        UX-04 CTA        UX-05/08/09   plan copy
```

| Slot | Numbers to watch | What the fix does |
|------|------------------|-------------------|
| Signup → onboarded | completion %, step drop-off | Resumable wizard removes "refresh = restart" loss; exact-email preview builds trust before commitment |
| Onboarded → first invoice | invoices created in first 24h | First-invoice card gives three concrete pathways (manual / CSV / connect) at the exact moment of zero-state |
| First invoice → first send | days from invoice to first "Send now" | Timeline shows exactly what will go out and when; mobile action sheet keeps Send now one tap away |
| First recovery | invoices recovered / first 90 days | Ladder is visible and honest; reply/promise auto-pause builds trust in the autopilot |
| First limit → Pro | limit-hit → checkout conversion | Plan page quotes the *real* quotas (10 invoices, 3 clients, 5 AI drafts) so the "why upgrade" is concrete; single provider path removes checkout dead-ends |

## Honesty rules (hard constraints, applied)

1. Never claim an outcome we didn't measure — removed "one recovered invoice
   pays for the year" from landing **and** pricing.
2. Free ≠ autopilot: copy now says Free = manual "Send now", Pro = autopilot.
3. Free features on the page must equal `src/lib/billing/limits.ts`.
4. Billing provider frame is honest (Paddle primary, Dodo fallback on some
   deploys) and checkout errors are user-readable.
5. No invented screenshots/testimonials anywhere (current or future).

## Not yet runnable in this environment

- **Analytics funnel**: there is no analytics provider wired for these events;
  product is instrumented at the DB level. Add events (onboarding step,
  invoice created, send now, recovery) before launch, then measure the slots
  above.
- **Live checkout validation** (G7) and **browser E2E** (Playwright absent).
- **Pricing display truth** still keys off `ProPrice`; verify against the live
  Paddle/Dodo product record (price, trial days, refund policy wording) before
  the marketing promise is relied on.