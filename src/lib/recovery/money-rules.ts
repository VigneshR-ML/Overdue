/** Money-critical pure rules (testable without DB). */

export type SettlementStatus = "draft" | "approved" | "sent" | "suspended" | "accepted" | "paid" | "expired" | "cancelled";
export type PlanStatus = "proposed" | "active" | "delinquent" | "completed" | "cancelled";
export type DisputeOutcome = "resolved" | "withdrawn" | "credit_issued" | "invoice_corrected";

/** Settlement <-> plan mutual exclusion */
export function canCreateSettlement(planStatus: PlanStatus | null): boolean {
  return planStatus === null || planStatus === "completed" || planStatus === "cancelled";
}
export function canActivatePlan(settlementStatus: SettlementStatus | null): boolean {
  // Live offer blocks auto-activation; suspended requires explicit owner choice.
  if (settlementStatus === null) return true;
  return ["paid", "expired", "cancelled"].includes(settlementStatus);
}

/** Dual control: above threshold creator and confirmer must differ. */
export function requiresDualControl(amountCents: number, thresholdCents: number): boolean {
  return amountCents > thresholdCents;
}
export function dualControlPasses(amountCents: number, thresholdCents: number, creator: string, confirmer: string): boolean {
  if (!requiresDualControl(amountCents, thresholdCents)) return true;
  return creator !== confirmer;
}

/** Dedupe keys (must match outbox/notification writers) */
export function dedupeKey(kind: "reminder" | "installment" | "proposal" | "receipt" | "digest", parts: string): string {
  return `${kind}:${parts}`;
}

/** Dispute outcome validity */
export function isValidDisputeOutcome(o: string): o is DisputeOutcome {
  return (["resolved", "withdrawn", "credit_issued", "invoice_corrected"] as string[]).includes(o);
}

/** Direct payment must not mark suspended offers paid (reporting hygiene) */
export function directPaymentOfferEndState(from: SettlementStatus): "paid" | "cancelled" | "unchanged" {
  if (["approved", "sent", "accepted"].includes(from)) return "paid";
  if (from === "suspended") return "cancelled"; // superseded_by_direct_payment
  return "unchanged";
}
