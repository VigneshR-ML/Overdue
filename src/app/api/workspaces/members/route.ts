import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { isValidInvite } from "@/lib/supabase/workspace-team";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Minimal team management (closes "tables-only" gap).
 * POST /api/workspaces/members { workspaceId, email, role } — owner only.
 * Creates workspace_invites row; actual email invite via outbox (member accepts in app).
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`team:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  let body: { workspaceId?: string; email?: string; role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!body.workspaceId || !isValidInvite(String(body.email ?? ""), String(body.role ?? ""))) {
    return NextResponse.json({ ok: false, error: "workspaceId, valid email, role admin|member|viewer required" }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const gate = await requireWorkspaceRole(supabase, user!.id, body.workspaceId, "owner");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — owner role required" }, { status: 403 });
  const { error: insErr } = await supabase.from("workspace_invites").insert({
    workspace_id: body.workspaceId, email: String(body.email).slice(0, 200), role: body.role, invited_by: user!.id,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
