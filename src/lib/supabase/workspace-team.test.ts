import { describe, expect, it } from "vitest";
import { canAcceptTransfer, canInitiateTransfer, isValidInvite } from "./workspace-team";

describe("workspace team invite/transfer", () => {
  it("invite validates email + role", () => {
    expect(isValidInvite("a@b.co", "member")).toBe(true);
    expect(isValidInvite("bad", "member")).toBe(false);
    expect(isValidInvite("a@b.co", "owner")).toBe(false); // invites never owner directly
    expect(isValidInvite("a@b.co", "superadmin")).toBe(false);
  });
  it("transfer requires owner caller + admin target", () => {
    expect(canInitiateTransfer("owner", "admin")).toBe(true);
    expect(canInitiateTransfer("admin", "admin")).toBe(false);
    expect(canInitiateTransfer("owner", "member")).toBe(false);
    expect(canInitiateTransfer(null, "admin")).toBe(false);
  });
  it("accept requires pending + target identity", () => {
    expect(canAcceptTransfer("pending", "u2", "u2")).toBe(true);
    expect(canAcceptTransfer("pending", "u1", "u2")).toBe(false);
    expect(canAcceptTransfer("accepted", "u2", "u2")).toBe(false);
  });
});
