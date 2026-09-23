/** Pure team rules (route-tested without DB). */

export type InviteRole = "admin" | "member" | "viewer";
export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled";

export function isValidInvite(email: string, role: string): boolean {
  if (!["admin", "member", "viewer"].includes(role)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.slice(0, 200));
}

export function canInitiateTransfer(callerRole: string | null, targetRole: string | null): boolean {
  return callerRole === "owner" && targetRole === "admin";
}

export function canAcceptTransfer(status: string, callerId: string, targetId: string): boolean {
  return status === "pending" && callerId === targetId;
}
