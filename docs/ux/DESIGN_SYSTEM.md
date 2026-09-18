# Overdue — Design System (Ledger)

The Long-Play "Ledger" identity: a paper ledger that never loses a number.
Warm paper, quiet ink, and conviction. Established tokens and rules are in
`tailwind.config`; this file documents *intent* so future screens stay on voice.

## Tone & voice

- Editorial and warm, not SaaS-y. Speak like the competent bookkeeper with a
  sense of humour: "No unpaid invoices on the board. Beautiful."
- Conviction about what the product does; absolute honesty about what it
  doesn't ("an expectation, not a promise", "no client email — reminders can't
  be sent"). No ROI marketing claims, no invented delivery evidence.

## Colour tokens (used throughout)

| Token | Role |
|-------|------|
| `paper` / `paper-grain` | Page background, warm paper |
| `surface` | Cards, panels |
| `hairline` | Borders, hairlines |
| `ink` / `ink-soft` | Primary / secondary text |
| `faint` | Meta text |
| `moss` / `moss-bright` / `moss-soft` | The brand colour; positive/paid/active |
| `ember` | Warning-leaning accent (slow payers, medium risk) |
| `crimson` | Danger (at-risk, critical, overdue long) |
| `brass` / `rust` | Forecast/risk mid-buckets |

## Type & rhythm

- Editorial display: `font-display` serif for page titles and hero numbers.
- Numbers: `money` class (tabular-nums) everywhere an amount appears — columns
  align. Currency is always shown (`formatMoney(cents, currency)`), never bare.
- `font-mono` uppercase tracking labels for section kickers (`text-[11px]
  tracking-[0.14em] text-muted`). This is the "carbon strip" language.
- Content max-width `prose` for explanations; `[text-[14px]]` body.

## Components & conventions

| Component | Rules |
|-----------|-------|
| `PageHeader` | `kicker / title / description / action` — every workspace page starts with one, actions right-anchored, wrap on mobile |
| `Card` | `border-hairline bg-surface shadow-ledger`, optional `CardHeader` mono label |
| `Badge` | `PaidBadge` / `OverdueBadge(days)` / `SentBadge` — paid is moss, overdue crimson, sent subtle |
| Buttons | `moss` = primary brand action · `paper` = on dark hero · `ink` = hard emphasis · `outline` / `ghost` secondary |
| Empty/error | `EmptyState` + a reason and a path; `ErrorLedger` for fatal with `reset` |
| Timeline dots | done = moss check · current = ember dot · pending = neutral circle; a hairline rail joins them |

## Interaction rules (new in this pass)

- **Mobile-first actions**: any primary action on a ledger row is reachable from
  a bottom action sheet (no hover-only controls).
- **Confirm destructive**: Mark paid / Pause use `confirm()` with honest copy.
- **Server truth wins**: after a reload, paused/sent/paid states come from the
  DB seed, not client memory.
- **Resumability**: multi-step flows persist step to `localStorage` and only
  claim completion after the server write succeeds.
- **Honesty in states**: a UI never implies an email was opened, delivered, or
  a payment made unless the DB proves it (`opened_at`, `paid_at`).