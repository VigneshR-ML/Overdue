# LAUNCH_READINESS.md

Readiness gate for the controlled production launch of Overdue.
Base commit: `d005e34e`. Every gate is either **PASS** (done, with evidence) or
**BLOCK / GATED** (must be cleared with the described action before go-live).

## Gate matrix

| # | Gate | Status | Evidence / required action |
|---|------|--------|---------------------------|
| G1 | Defect remediation | **PASS (22/28)** | BUG_REPORT.md. D21/D22/D23/D26/D28 remain outside the fix set — reconcile them against the original audit before treating the register as closed. |
| G2 | Unit suite | **PASS** | `npx vitest run` → 193/193 (TEST_RESULTS.md). |
| G3 | Typecheck | **PASS** | `npx tsc --noEmit` clean. |
| G4 | Production build | **PASS** | `npm run build` green, all routes compiled. |
| G5 | Migrations applied to live project | **BLOCK** | Apply `supabase/migrations/0018_*.sql` (fresh: `supabase db reset`; existing: `supabase db push`). Then confirm: `subscriptions_user_uidx` exists (no pre-dupes → dedupe step else run it and re-run migration), `runs_one_active_per_invoice` exists, `messages.status` column present, `payment_plan_requests` present, `subs_all_own` gone. |
| G6 | E2E smoke (browser) | **BLOCK** | `@playwright/test` not installed; `test-results/` empty. Scenarios: signup → connect CSV → ladder run → send-now → reply-webhook pause → accept offer → discounted pay intent → mark-paid reconcile → pause/resume seeding → account export → account delete. Install runner or run a release checklist in staging. |
| G7 | Live provider smoke | **BLOCK** | No Paddle/Dodo/Resend/PayPal/Xero keys here. Verify on staging: Paddle checkout → `transaction.completed` webhook upgrades the right user row (sub id, not tx id); Dodo same; `email.received` inbound (Resend) pauses the matched thread; Svix `v1,<b64>` signature accepted and legacy rejected. |
| G8 | Cron / workflow | **PASS (config)** — **verify live** | `dispatch.yml` now fails on non-200/`ok:false`. Confirm `DISPATCH_URL` + `CRON_SECRET` set in repo secrets and a workflow_dispatch run returns 200 with `{"ok":true,...}`. |
| G9 | Secrets hygiene | **PASS** | Only `.env.example` tracked; app logs strip provider secrets (billing error serializers). Confirm prod Vercel env vars mirror `.env.example` keys. |
| G10 | Known operational caveats | **PASS (documented)** | See "Caveats that are intentional" below. |
| G11 | Data repair for existing tenants | **BLOCK (only if prod already has tenants)** | No prod data exists (not launched). If a prior dev environment has seeded ladders with `[1,7,7,7]`, 0018 fixes them; add-on off-grid ladder delays set by users before now are respected as authored. |

## Caveats that are intentional (review before launch)
- **Settlement events can dupe `viewed`** — `settlement_events` has no unique
  constraint; the resolution page writes a `viewed` row without an onConflict
  guard. Harmless analytically, but the page can double-log on retry. Acceptable
  for v1; add a dedupe constraint in a later migration.
- **Active-run index is best-effort on dirty DBs** — if any pre-existing invoice
  already has two active runs at migration time, `runs_one_active_per_invoice`
  is skipped (exception swallowed) to avoid failing the deploy. G5 requires
  confirming the index exists; if skipped, dedupe first.
- **One subscription row per user** — both providers now upsert on `user_id`.
  A paddle+ dodo simultaneous upgrade is a business edge case; the migration's
  dedupe prefers paddle-bound rows but the events handler will keep the newest
  event's provider on the single row.
- **Provider "not configured" during account delete** — if a sub id exists but
  the provider API key is missing in the environment, deletion warns and
  proceeds (can't cancel what isn't reachable). If the key IS configured and the
  cancel call fails, deletion blocks with a clear message.
- **Dispatch report granularity** — `runDispatcher` returns `{ok:true,
  dispatched, failed}` even when some individual sends fail (failed is counted);
  the workflow only fails on `ok:false` to avoid hourly false alarms. Watch
  `failed` in the workflow output for send-backoff patterns.
- **Free-plan import cap** — CSV import stops at `FREE_INVOICE_LIMIT` total
  invoices and skips (rather than orphaning) rows whose client can't be created
  under `FREE_CLIENT_LIMIT`.

## Recommended pre-launch checklist (order)
1. G5 (apply + verify migration 0018 on the real project). 
2. G7 provider smoke (Paddle + Dodo + Resend inbound + Svix).
3. G6 E2E scenarios (install Playwright or run the manual release checklist).
4. G8 workflow_dispatch run → observe green with parsed report.
5. G1 → clear D21/D22/D23/D26/D28 against the source audit, then ship the
   closed register.
6. Re-run `npx vitest run`, `npx tsc --noEmit`, `npm run build` on the exact
   commit that will be promoted, and record output into TEST_RESULTS.md.

## Verdict
Code-level launch gates G1–G4, G9–G11 are PASS. The software is **ready for a
staging/limited production environment** once G5–G8 are cleared against live
infrastructure. Do not announce/enable paid billing until G7 confirms the real
webhook flow end-to-end.