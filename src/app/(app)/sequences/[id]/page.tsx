import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { isDemoMode, demoSequenceById } from "@/lib/demo/fixtures"
import { SequenceEditor } from "@/components/ledger/sequence-editor"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Ladder" }

export const dynamic = "force-dynamic"

export default async function SequenceDetailPage({ params }: { params: { id: string } }) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  let seq: {
    id: string
    name: string
    description: string | null
    is_active: boolean
    is_template: boolean
    user_id: string
    steps: unknown
  } | null

  if (isDemoMode()) {
    const demo = demoSequenceById(params.id)
    if (!demo) notFound()
    seq = demo as typeof seq
  } else {
    const supabase = (await import("@/lib/supabase/server")).createClient()
    const { data } = await supabase
      .from("sequences")
      .select("*")
      .eq("id", params.id)
      .single()
    seq = data as typeof seq
  }

  if (!seq || (seq.user_id !== session.id && !seq.is_template)) notFound()

  return (
    <div className="space-y-5">
      <Link href="/sequences" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Ladders
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight text-ink">{seq.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Edit the rungs, preview the messages, and the scheduler takes it from here.
        </p>
      </header>

      {seq.is_template ? (
        <div className="rounded-lg border border-ember/40 bg-ember/10 p-4 text-sm text-ink-soft">
          You're viewing the shared template <span className="font-mono text-[13px]">{seq.name}</span>. Save your changes
          as a personal ladder — templates are read-only.
        </div>
      ) : null}

      <SequenceEditor
        id={seq.id}
        initial={{
          name: seq.name,
          is_active: seq.is_active,
          steps: seq.steps as unknown as { id: string; step_order: number; delay_days: number; tone: "gentle" | "nudge" | "firm" | "final"; subject_template: string; body_template: string; ai_enabled: boolean }[],
        }}
      />
    </div>
  )
}