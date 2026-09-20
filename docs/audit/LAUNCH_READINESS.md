# LAUNCH_READINESS.md

Readiness gate for the controlled production launch of Overdue.
Hardening HEAD: `f2b3d2c` (base `d005e34e`). Every gate is either **PASS**
(done, with evidence) or **BLOCK / GATED** (must be cleared with the described
action before go-live).

## Gate matrix

| # | Gate | Status | Evidence / required action |
|---|------|--------|---------------------------|
| G1 | Defect remediation | **PASS (27/32)** | BUG_REPORT.md. D21/D22/D23/D26/D28 were registered in the source audit but not reproduced here — reconcile them against the original audit before treating the register as closed. |
| G2 | Unit suite | **PASS** | `npm test` → 217/217 across 28 files (TEST_RESULTS.md). |
| G3 | Typecheck | **PASS** | `npx tsc --noEmit` clean. |
| G4 | Production build | **PASS** | `npm run build` green on Next.js 16.3.5; bundled fonts remove build-time Google dependency. |
| G5 | Migrations applied to live project | **BLOCK** | Apply `0018_hardening_fixes.sql` and `0019_api_write_boundary.sql`, then confirm the 0018 indexes/columns and that authenticated direct writes to business tables are denied while owner reads still work. |
| G6 | E2E smoke (browser) | **PARTIAL PASS** | Committed Playwright smoke passes for five public routes, runtime errors, framework overlays, and tablet overflow. Authenticated/provider flows remain blocked until an identifiable Supabase deployment/test account is connected. |
| G7 | Live provider smoke | **BLOCK** | No Paddle/Dodo/Resend/PayPal/Xero keys here. Verify on staging: Paddle checkout → `transaction.completed` webhook upgrades the right user row (sub id, not tx id); Dodo same; `email.received` inbound (Resend) pauses the matched thread; Svix `v1,<b64>` signature accepted and legacy rejected. |
| G8 | Cron / workflow | **PASS (config)** — **verify live** | `dispatch.yml` now fails on non-200/`ok:false`. Confirm `DISPATCH_URL` + `CRON_SECRET` set in repo secrets and a workflow_dispatch run returns 200 with `{"ok":true,...}`. |
| G9 | Secrets hygiene | **PASS** | Only `.env.example` tracked; app logs strip provider secrets (billing error serializers). Confirm prod Vercel env vars mirror `.env.example` keys. |
| G10 | Known operational caveats | **PASS (documented)** | See "Caveats that are intentional" below. |
| G11 | Data repair for existing tenants | **BLOCK (only if prod already has tenants)** | No prod data exists (not launched). If a prior dev environment has seeded ladders with `[1,7,7,7]`, 0018 fixes them; add-on off-grid ladder delays set by users before now are respected as authored. |
| G12 | Dependency security | **PASS** | Upgraded Next.js/React/Vitest toolchains; `npm audit` reports **0 vulnerabilities** including dev dependencies. |

## Caveats that are intentional (review before launch)
- **Paid webhooks acknowledge only succeeded writes (D29)** — a Stripe/PayPal/
  Xero paid event whose DB flip fails gets a 500 so the provider retries; the
  paid signal can no longer be silently dropped. Verify one retry path on
  staging (G7).
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
- **Sync concurrency (lead L, no new fix)** — provider sync is user-triggered;
  upserts are idempotent (unique `(user_id, provider, provider_id)`) and the
  in-process refresh mutex covers one instance. The only residual race is a rare
  cross-instance token refresh error, which self-heals on the next sync. If
  hourly cross-provider syncing is ever added, wrap it in a DB lease.
- **Ladder edits don't reset run progress (lead R)** — PUT updates apply to
  all runs on the next dispatch (steps are read fresh per send); a structural
  edit mid-ladder continues at the current step index against new content.
  Intentional; document in help copy if confusing.

## Recommended pre-launch checklist (order)
1. G5 (apply + verify migrations 0018 and 0019 on the real project).
2. G7 provider smoke (Paddle + Dodo + Resend inbound + Svix).
3. G6 authenticated E2E scenarios on the connected staging project.
4. G8 workflow_dispatch run → observe green with parsed report.
5. G1 → clear D21/D22/D23/D26/D28 against the source audit, then ship the
   closed register.
6. Re-run `npx vitest run`, `npx tsc --noEmit`, `npm run build` on the exact
   commit that will be promoted, and record output into TEST_RESULTS.md.

## Verdict
Code-level launch gates G1–G4 and G9–G12 pass; public browser smoke is also
complete. The software is **ready for staging** once G5 is applied. Do not
announce/enable paid billing until authenticated E2E, live provider webhooks,
and the cron run are verified against the actual deployment (G6–G8).
