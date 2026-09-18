# Overdue — Test Results (UX pass)

Run on `main` at HEAD with all UX-pass changes applied, **2026-09-18**.
Environment: linux, node v22, repo `/home/leodas/mvp/overdue`.

## What passed

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | Clean (0 errors) |
| Lint | `npx next lint` | No ESLint warnings or errors |
| Unit / integration | `npx vitest run` | **213/213 passed** (26 files) |
| Production build | `npm run build` | Succeeded; `/invoices/[invoiceId]` compiles as dynamic |

Test delta vs prior master-pass baseline (197/213): **+16 new tests** —
`src/lib/onboarding/schedule.test.ts` (+9) and `src/lib/onboarding/timeline.test.ts`
(+7), covering ladder absolute offsets, preview-message tokens, and the strict
milestone-state logic of the invoice timeline.

## What was deliberately NOT run

| Item | Why | How to unblock |
|------|-----|----------------|
| Browser renders / screenshots (BEFORE/AFTER) | Playwright not installed in this environment | `npm i -D @playwright/test`, `npx playwright install`, then capture the 8 P0 screens in `BEFORE_AFTER.md` |
| E2E flows (onboarding save/reload, action sheet, checkout) | Same as above | Same; then codify as `e2e/*.spec.ts` |
| Live checkout / email delivery | No Paddle/Dodo/Resend/other provider keys (audit G7) | Provide sandbox keys |
| Live DB behaviour after migration 0018 | Migration not applied to live Supabase (audit G5) | Apply migration, parity review |
| `npm audit` prod findings | Blocked on `next@16` breaking upgrade (audit G12) | Schedule upgrade, re-run gate |

## Honesty note

Every item above labelled "passed" is a real run from this session — no
invented results. Screenshots are the one visual artifact we could not produce;
that is stated openly rather than filled with fakes.