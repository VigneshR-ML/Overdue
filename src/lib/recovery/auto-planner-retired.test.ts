import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Regression guard: the interim auto-planner must stay unreachable from the
 * debtor-facing canonical plan-request flow. One request creates zero auto
 * proposals; the owner builds one versioned proposal via POST /api/plans.
 * (The settings toggle route may keep its opt-in flag; the trigger itself
 * must never fire on plan_request.)
 */
describe("auto-planner retirement", () => {
  const routeSrc = fs.readFileSync(
    path.join(__dirname, "../../app/api/r/[token]/resolve/route.ts"),
    "utf8",
  );

  it("canonical resolve route never imports the auto-planner", () => {
    expect(routeSrc).not.toContain("auto-payment-plan");
    expect(routeSrc).not.toContain("createAutoPaymentPlanProposal(");
  });

  it("canonical route keeps under_review + expiry + suspend (no legacy accepted flip)", () => {
    expect(routeSrc).toContain('status: "under_review"');
    expect(routeSrc).toContain("expires_at");
    expect(routeSrc).toContain('status: "suspended"');
  });

  it("auto-planner module still exists but is triggerless from debtor flow", async () => {
    const mod = await import("@/lib/recovery/auto-payment-plan");
    expect(typeof mod.createAutoPaymentPlanProposal).toBe("function");
    // Only non-debtor reference allowed: the owner settings toggle.
    const settingsSrc = fs.readFileSync(
      path.join(__dirname, "../../app/api/settings/payment-planner/route.ts"),
      "utf8",
    );
    expect(settingsSrc).toContain("payment_plan_automation_settings");
  });
});
