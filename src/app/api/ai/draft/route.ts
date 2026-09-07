import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { draftEmail } from "@/lib/ai/draft"

export const dynamic = "force-dynamic"

/**
 * Draft an escalation email for an invoice+step. Used by the message editor for
 * instant previews. Requires an authenticated session and only ever accesses the
 * authenticated user's own data (RLS-equivalent ownership check via service role).
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { invoiceId, subjectTemplate, bodyTemplate, tone, aiEnabled } = await request.json()
  if (!user!.id || !invoiceId) return NextResponse.json({ ok: false, error: "invoiceId required" }, { status: 400 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", user!.id)
    .single()
  if (!invoice) return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 })

  const clientId = invoice.client_id
  const { data: client } = clientId
    ? await supabase.from("clients").select("*").eq("id", clientId).eq("user_id", user!.id).single()
    : { data: null }
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user!.id).single()

  const draft = await draftEmail({
    tone,
    subjectTemplate,
    bodyTemplate,
    invoice: invoice as any,
    client: client as any,
    sender: {
      name: profile?.full_name ?? "You",
      company: process.env.NEXT_PUBLIC_APP_NAME ?? "Overdue",
      email: profile?.email ?? "",
    },
    aiEnabled: Boolean(aiEnabled),
  })

  return NextResponse.json({ ok: true, ...draft })
}
