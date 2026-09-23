export type PlanFrequency = "weekly" | "biweekly" | "monthly";

export interface PlanInputs {
  totalCents: number; // T: approved plan total
  preferredCents: number; // P: debtor preferred max installment
  minCents: number; // M: workspace minimum
  maxCount: number; // Cmax
  maxDurationDays: number; // Dmax
  frequency: PlanFrequency;
}

export interface PlanResult {
  kind: "plan" | "counter" | "no_plan";
  installments: number[];
  count: number;
  exceedsDebtorPreference: boolean;
  counterReason: "exceeds_allowed_count" | "final_below_minimum" | null;
  reason: string | null;
  disclosure: string | null;
}

export function periodDaysFor(frequency: PlanFrequency): number {
  if (frequency === "weekly") return 7;
  if (frequency === "biweekly") return 14;
  // Conservative 31-day month so floor(Dmax/31)+1 never over-admits vs real
  // calendar months (28-31d) used by buildDueDates anchor_day logic.
  return 31;
}

export function countThatFitsWithinDmax(maxDurationDays: number, frequency: PlanFrequency): number {
  const period = periodDaysFor(frequency);
  return Math.floor(maxDurationDays / period) + 1;
}

export function allowedCount(maxCount: number, maxDurationDays: number, frequency: PlanFrequency): number {
  return Math.max(1, Math.min(maxCount, countThatFitsWithinDmax(maxDurationDays, frequency)));
}

export function splitEvenly(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Final installment algorithm with explicit precedence (fixes overlapping-branch bug):
 * 1. validate inputs
 * 2. if desired_count > allowed_count -> counter with allowed_count (may exceed P),
 *    then floor-check: if evenly-split min < M, shrink count until >= M or no_plan
 * 3. elif final_amount < M -> counter with desired_count-1 (or no_plan if <2)
 * 4. else -> honor P: (n-1) x P + final
 * Never silently equalizes or silently exceeds P without disclosure.
 * counterReason is a named enum (not a vague boolean): exceeds_allowed_count | final_below_minimum.
 */
export function buildInstallments(inputs: PlanInputs): PlanResult {
  const { totalCents: T, preferredCents: P, minCents: M, maxCount, maxDurationDays, frequency } = inputs;
  if (!Number.isFinite(T) || T <= 0) return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "total must be > 0", disclosure: null };
  if (!Number.isFinite(P) || P <= 0) return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "preferred amount must be > 0", disclosure: null };
  if (P >= T) return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "single payment — route to direct full payment / settlement", disclosure: null };
  if (P < M) return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "preferred amount below minimum installment", disclosure: null };

  const allowed = allowedCount(maxCount, maxDurationDays, frequency);
  const desired = Math.ceil(T / P);
  const finalAmount = T - P * (desired - 1);

  // Branch 1 (highest precedence): too many installments
  if (desired > allowed) {
    // Floor-check the counter itself: a strict cap on a small invoice can push
    // T/allowed below M. Shrink until min(split) >= M; fewer installments =
    // larger amounts, so descending finds the largest feasible count.
    for (let n = allowed; n >= 2; n--) {
      const installments = splitEvenly(T, n);
      const min = Math.min(...installments);
      if (min >= M) {
        const exceeds = installments.some((a) => a > P);
        return {
          kind: "counter",
          installments,
          count: n,
          exceedsDebtorPreference: exceeds,
          counterReason: "exceeds_allowed_count",
          reason: "desired_count exceeds policy",
          disclosure: exceeds
            ? "This counter-proposal exceeds your preferred payment amount because of the maximum plan duration / installment limit. Owner review required — never auto-activated."
            : "Counter-proposal within policy limits. Owner review required.",
        };
      }
    }
    return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "no feasible counter-proposal meets minimum installment — route to settlement/direct", disclosure: null };
  }
  // Branch 2: final installment below minimum
  if (finalAmount < M) {
    const n = desired - 1;
    if (n < 2) {
      return { kind: "no_plan", installments: [], count: 0, exceedsDebtorPreference: false, counterReason: null, reason: "no payment plan possible without a below-minimum final installment — route to settlement/direct", disclosure: null };
    }
    return {
      kind: "counter",
      installments: splitEvenly(T, n),
      count: n,
      exceedsDebtorPreference: false,
      counterReason: "final_below_minimum",
      reason: "Counter-proposal: final payment would otherwise be below your minimum installment.",
      disclosure: "Counter-proposal: final payment would otherwise be below your minimum installment. Owner and debtor approval required.",
    };
  }
  // Branch 3: honor preference
  const installments = [...Array(desired - 1).fill(P), finalAmount];
  return { kind: "plan", installments, count: desired, exceedsDebtorPreference: false, counterReason: null, reason: null, disclosure: null };
}

/**
 * Calendar-accurate Dmax check against real due dates (not the 31-day approximation).
 * Caller (proposal API with startsOn) must shrink count until this returns false.
 */
export function lastDueDateExceedsDmax(startIso: string, frequency: PlanFrequency, count: number, maxDurationDays: number): boolean {
  const dates = buildDueDates(startIso, frequency, count);
  const first = Date.parse(`${dates[0]}T00:00:00Z`);
  const last = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  return (last - first) / 86400000 > maxDurationDays;
}

/** Due dates in workspace timezone (date-only). Monthly preserves anchor_day: Jan31->Feb28->Mar31. */
export function buildDueDates(startIso: string, frequency: PlanFrequency, count: number): string[] {
  const [y, m, d] = startIso.split("-").map(Number);
  const anchor = d;
  const out: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (frequency === "weekly" || frequency === "biweekly") {
    const step = frequency === "weekly" ? 7 : 14;
    let cur = Date.UTC(y, m - 1, d);
    for (let i = 0; i < count; i++) {
      const dt = new Date(cur);
      out.push(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`);
      cur += step * 86400000;
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1 + i, 1));
    const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(anchor, last);
    out.push(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(day)}`);
  }
  return out;
}
