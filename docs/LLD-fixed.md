# Overdue — Fixed LLD (2026-09-23)

## 1. Algorithm (`src/lib/recovery/payment-plan.ts`)
```
T>0, P>0, P>=M else no_plan. P>=T -> direct payment.
allowed = min(Cmax, floor(Dmax/period_days)+1)
desired = ceil(T/P); final = T-P*(desired-1)
if desired>allowed: counter(allowed, evenly split, exceeds flag + disclosure)
elif final<M: counter(desired-1 evenly split) or no_plan if <2
else: plan = (n-1)xP + final
Example 1140/300/100 -> 300+300+300+240
```
Due dates: weekly +7, biweekly +14, monthly anchor_day (Jan31->Feb28->Mar31), date-only + workspace tz label.

## 2. Tables
- `0021_workspaces.sql`: workspaces, members, workspace_id backfill, settlement `suspended`, request `submitted/under_review/converted/closed/expired + close_reason/expires_at`.
- `0022_payment_plans.sql`: settings, `payment_plans(proposal_version,supersedes,policy_snapshot,completion_source,cancellation_reason,counter flags)`, `plan_installments`, `payments(source stripe/paypal/xero_sync/manual/bank_transfer + checkout_attempt_id)`, `checkout_attempts`, one-open-request index.
- `0023_workflow.sql`: `workflow_events` append-only trigger, `notifications(workspace,member,dedupe_key)`, `debtor_portal_sessions(invoice required)`, `webhook_receipts`, `outbox_jobs`, `manual_payment_approvals`.

## 3. APIs
- `POST /api/r/[token]/resolve plan_request`: collects P/frequency/start-date, 2-per-30d limit, 72h expiry, suspends settlement, pauses ladder.
- `PATCH /api/plan-requests/[id] decline|cancel|withdraw`: closes with reason, resumes ladder +24h, resumes suspended offer, outbox decline email.
- `POST /api/plans`: owner proposal via algorithm, immutable version, installments + dates, disclosure, policy snapshot. Never sets converted.
- `PATCH /api/plans/[id] debtor_accept|debtor_decline|owner_cancel`: accept sets plan active + request converted.
- `PATCH /api/disputes/[id] resolved|withdrawn|credit_issued|invoice_corrected`: resolves dead end, resume +24h or cancel chase.
- `POST /api/payments/manual`: ledger row + dual control + audit, never blind toggle.
- `POST /api/portal/renew`: renewable 30d session, fresh-link flow.
- `reconcilePaidWork`: runs cancelled, disputes resolved, offers paid (incl suspended), requests closed/invoice_paid_directly, plans completed/direct_invoice_payment, workflow event.

## 4. Dispatcher (`dispatch.ts`)
- Promise future -> hold; past -> `promise_missed=true`, workflow event, resume +24h.
- Expire stale requests opportunistically; gates check `submitted/under_review/open`.
- `current_step` canonical; UI says rung vs installment.

## 5. UI
- `resolution-view.tsx`: amount/frequency/date inputs, disclosure copy, 72h notice.
- Invoice detail keeps rung wording; recovery flow unchanged.
- Owner uses plan/dispute APIs + portal renew for long plans.

## 6. Dedupe keys
- reminder `run+step`, installment `installment+stage`, proposal `request+proposal_version`, receipt `payment_id`, digest `workspace+date`.

## 7. Verify
- `payment-plan.test.ts` 7 pass (precedence, even division, Dmax formula, anchor_day).
- `launch-check.sh` now asserts 0020-0023.
- Run: `npm run lint`, `npm test`, `npm run build`, apply migrations to prod Supabase, e2e provider + cron + Resend.
