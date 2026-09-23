import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Dead-man health for the single cron path (GitHub Actions → POST /api/cron/dispatch).
 * Returns degraded when no successful heartbeat in the last 2h.
 * Wire an external monitor (e.g. Better Uptime / Healthchecks) to alert on degraded.
 */
export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, status: "unknown" }, { status: 500 });
  const { data } = await supabase.from("cron_heartbeats").select("ok, created_at")
    .eq("job", "dispatch").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const row = data as { ok: boolean; created_at: string } | null;
  if (!row) return NextResponse.json({ ok: true, status: "no_runs_yet" });
  const ageMin = (Date.now() - new Date(row.created_at).getTime()) / 60000;
  if (!row.ok) return NextResponse.json({ ok: false, status: "last_run_failed", ageMin: Math.round(ageMin) }, { status: 503 });
  if (ageMin > 120) return NextResponse.json({ ok: false, status: "degraded_no_recent_success", ageMin: Math.round(ageMin) }, { status: 503 });
  return NextResponse.json({ ok: true, status: "healthy", ageMin: Math.round(ageMin) });
}
