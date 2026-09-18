# Overdue — User Journey Map

Three journeys that matter for the business. The **first-recovery journey** is
numbered P0 and is what this redesign optimises; the other two must not regress.

Editorial voice everywhere: warm paper, ledger ink, a quiet expert. Conviction in
what we did and full honesty about what we didn't.

## Journey 1 — First successful recovery (P0, this pass)

```
landing ──► signup ──► ONBOARDING (5 steps, resumable)
                       1. who you are (auto-filled from auth; editable)
                       2. first invoice (manual / import CSV / connect)
                       3. your ladder (real schedule table from the DB)
                          Free: 1 ladder, manual Send now · Pro: autopilot daily
                       4. preview the EXACT first email (with their data)
                       5. done ── page only exits after onboarding_completed writes
                              ▼
                     /dashboard (first-invoice card, no more zeros)
                              ▼
              invoice past due → recovery ladder + queue
                              ▼
            client replies / promise / dispute → ladder auto-pauses,
              reply thread shows the machine's confidence + raw words
                              ▼
                    owner presses Send now (Free) / autopilot (Pro)
                              ▼
                    payment recorded → ledger row + detail timeline "resolved"; offer settles
```

Drop-out points and the fix in this pass:
- **Mid-wizard refresh / back** — was data loss; now every step is persisted and
  the wizard resumes exactly where you stopped.
- **"No client email" invoices looking like they have reminders** — now the
  timeline marks it a blocker and the table/detail say reminders can't send
  until an email exists; the form lets you save as a draft instead of failing.
- **Empty ledger meaning nothing to do** — replaced with concrete first actions.
- **What does the email actually say?** — the wizard previews the exact first
  message, with their name, amount, currency and a due date, before anything is
  created.

## Journey 2 — Day-to-day collections habit

```
       /dashboard (who's overdue, next action, forecast strip)
              │
   ┌──────────┼───────────────┐
   ▼          ▼               ▼
  /invoices  /invoices/[id]   /insights
  action     timeline,        where risk lives,
  sheet on   settlement       who pays late,
  mobile     anchor, thread   cash forecast
```

- Every row in the ledger opens its own page; the mobile action sheet keeps
  Send now / Pause / Mark paid / Settle one tap from any row — no hover needed.
- Deep links: `?focus=<id>` pinpoints a row, `#settlement` jumps to the offer.

## Journey 3 — Getting to Pro (monetisation)

```
  Free trial (7d) ──► hit a real limit (10 invoices / 3 clients / autopilot off)
                 ──► billing page: honest limits, clear price, trial countdown
                 ──► one provider path (Paddle), Dodo fallback server-side
                 ──► checkout errors shown plainly, reframed as resolvable
                 ──► 30-day refund, cancel in two clicks
```

Honesty rules enforced in copy: no ROI claims, Free features = the real quotas
from `src/lib/billing/limits.ts`, autopilot is Pro-gated and the copy says so.