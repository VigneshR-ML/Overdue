import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getTemplates } from "@/lib/db/queries"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { TonePill } from "@/components/ledger/escalation-ladder"
import type { SequenceStep } from "@/types"

export const metadata = { title: "New ladder" }

export const dynamic = "force-dynamic"

export default async function NewSequencePage({ searchParams }: { searchParams: { from?: string } }) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const templates = await getTemplates()

  const preset = searchParams.from
    ? templates?.find((t) => t.id === searchParams.from)
    : null

  async function createFromTemplate(formData: FormData) {
    "use server"
    const templateId = formData.get("templateId") as string
    const name = (formData.get("name") as string) || "My ladder"

    const session = await getSessionUser()
    if (!session) return
    const supabase = (await import("@/lib/supabase/server")).createClient()

    // Enforce free plan limits.
    const { count } = await supabase
      .from("sequences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id)
      .eq("is_template", false)
    const plan = (await import("@/lib/billing/plan")).getPlan(session.id)
    const currentPlan = await plan
    if (currentPlan === "free" && (count ?? 0) >= 1) {
      redirect("/sequences?error=free-limit")
    }

    const { data: tpl, error: tplErr } = await supabase
      .from("sequences")
      .select("steps")
      .eq("id", templateId)
      .eq("is_template", true)
      .single()
    if (tplErr || !tpl?.steps) {
      redirect("/sequences?error=bad-template")
    }
    const steps = ((tpl.steps as unknown as SequenceStep[]) ?? []).map((s) => ({
      ...s,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }))

    const { data, error } = await supabase
      .from("sequences")
      .insert({ user_id: session.id, name, is_active: true, steps, is_template: false })
      .select("id")
      .single()

    if (!error && data) redirect(`/sequences/${data.id}`)
  }

  return (
    <div className="space-y-5">
      <Link href="/sequences" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Ladders
      </Link>

      <header>
        <h1 className="font-display text-3xl tracking-tight text-ink">New ladder</h1>
        <p className="mt-1 text-sm text-muted">Start from a proven template — tweak the rungs after.</p>
      </header>

      {preset ? (
        <form action={createFromTemplate} className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <input type="hidden" name="templateId" value={preset.id} />
          <div className="font-display text-xl text-ink">Clone “{preset.name}”</div>
          <div className="mt-1 text-sm text-muted">{preset.description}</div>
          <div className="mt-3 flex gap-1.5">
            {(preset.steps as unknown as SequenceStep[]).map((s) => <TonePill key={s.id} tone={s.tone} />)}
          </div>
          <div className="mt-5 max-w-sm">
            <input
              name="name"
              defaultValue={`${preset.name} (mine)`}
              className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-ink-soft focus:outline-none focus:ring-2 focus:ring-ink/10"
              placeholder="My ladder"
            />
          </div>
          <div className="mt-5">
            <Button type="submit" variant="moss">Create ladder</Button>
          </div>
        </form>
      ) : (
        <form action={createFromTemplate} className="space-y-4">
          <div className="flex max-w-sm items-end gap-3">
            <label className="block flex-1 space-y-1.5">
              <span className="text-[13px] font-medium text-ink-soft">Ladder name</span>
              <input
                name="name"
                defaultValue="My ladder"
                className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-ink-soft focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </label>
            <Button type="submit" variant="ink">Blank ladder</Button>
          </div>
        </form>
      )}

      {!preset && templates?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const steps = t.steps as unknown as SequenceStep[]
            return (
              <a
                key={t.id}
                href={`/sequences/new?from=${t.id}`}
                className="group rounded-lg border border-hairline bg-surface p-5 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-soft"
              >
                <div className="font-display text-lg text-ink group-hover:text-moss">{t.name}</div>
                <p className="mt-1 text-[13px] text-muted">{t.description}</p>
                <div className="mt-4 flex gap-1.5">
                  {steps.map((s) => <TonePill key={s.id} tone={s.tone} />)}
                </div>
              </a>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}