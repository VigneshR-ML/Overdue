import { describe, expect, it } from "vitest";
import { allowedCount, buildDueDates, buildInstallments, countThatFitsWithinDmax } from "./payment-plan";

describe("payment-plan algorithm", () => {
  it("honors preference: 1140/300/100 -> 300+300+300+240", () => {
    const r = buildInstallments({ totalCents: 114000, preferredCents: 30000, minCents: 10000, maxCount: 12, maxDurationDays: 365, frequency: "monthly" });
    expect(r.kind).toBe("plan");
    expect(r.installments).toEqual([30000, 30000, 30000, 24000]);
  });
  it("even division has no dead branch: 1200/300 -> 4x300 via plan branch", () => {
    const r = buildInstallments({ totalCents: 120000, preferredCents: 30000, minCents: 10000, maxCount: 12, maxDurationDays: 365, frequency: "monthly" });
    expect(r.kind).toBe("plan");
    expect(r.installments).toEqual([30000, 30000, 30000, 30000]);
  });
  it("precedence: desired>allowed wins over final<M", () => {
    const r = buildInstallments({ totalCents: 1140000, preferredCents: 10000, minCents: 10000, maxCount: 4, maxDurationDays: 365, frequency: "monthly" });
    // desired=114 > allowed=4 -> counter with 4, exceeds preference, disclosure set
    expect(r.kind).toBe("counter");
    expect(r.count).toBe(4);
    expect(r.exceedsDebtorPreference).toBe(true);
    expect(r.disclosure).toMatch(/exceeds your preferred/i);
  });
  it("final<M counters with n-1 evenly split", () => {
    // T=1050, P=500 -> desired=3, final=50 <M=100 -> counter 2 x 525
    const r = buildInstallments({ totalCents: 105000, preferredCents: 50000, minCents: 10000, maxCount: 12, maxDurationDays: 365, frequency: "monthly" });
    expect(r.kind).toBe("counter");
    expect(r.installments).toEqual([52500, 52500]);
  });
  it("P>=T routes to direct payment", () => {
    expect(buildInstallments({ totalCents: 50000, preferredCents: 60000, minCents: 10000, maxCount: 12, maxDurationDays: 365, frequency: "monthly" }).kind).toBe("no_plan");
  });
  it("Dmax formula is deterministic (conservative 31d month)", () => {
    expect(countThatFitsWithinDmax(365, "weekly")).toBe(Math.floor(365 / 7) + 1);
    expect(countThatFitsWithinDmax(90, "monthly")).toBe(Math.floor(90 / 31) + 1);
    expect(allowedCount(12, 365, "monthly")).toBe(Math.min(12, Math.floor(365 / 31) + 1));
  });
  it("monthly anchor_day: Jan31->Feb28->Mar31", () => {
    expect(buildDueDates("2026-01-31", "monthly", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});
