import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getSequencesWithRuns, getTemplates } from "@/lib/db/queries"
import { TonePill } from "@/components/ledger/escalation-ladder"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { SequenceStep } from "@/types"

export const metadata = { title: "Ladders" }

export const dynamic = "force-dynamic"

export default async function SequencesPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const userId = session.id

  const sequences = await getSequencesWithRuns(userId)
  const mine = sequences.filter((s) => s.user_id === userId && !s.is_template)

  const templates = await getTemplates()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Escalation</div>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Ladders</h1>
          <p className="mt-1 text-sm text-muted">
            Four rungs. Gentle to final. The flame only gets warmer when it has to.
          </p>
        </div>
        <a href="/sequences/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New ladder
          </Button>
        </a>
      </header>

      {mine.length === 0 && (
        <div className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
          <div className="font-display text-lg text-ink">You don't have a custom ladder yet</div>
          <p className="mt-1 max-w-measure text-sm text-muted">
            Your default "Standard Ladder" was created on signup and runs automatically when you attach a
            sequence to an invoice. Clone a proven template below to shape your own.
          </p>
        </div>
      )}

      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Your ladders</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {mine.length === 0
            ? (templates ?? []).filter((t) => t.name === "Standard Ladder").map((t) => (
                <SequenceCard key={t.id} name={t.name} description={t.description} steps={t.steps as unknown as SequenceStep[]} href={`/sequences/new?from=${t.id}`} meta="start here · make it yours" active={false} />
              ))
            : mine.map((s) => (
                <SequenceCard
                  key={s.id}
                  name={s.name}
                  description={s.description}
                  steps={s.steps as unknown as SequenceStep[]}
                  href={`/sequences/${s.id}`}
                  meta={`${(s.steps as unknown as SequenceStep[]).length} rungs · ${s.runs.length} activ${s.runs.length === 1 ? "e" : "es"}`}
                  active={s.is_active}
                />
              ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Proven templates</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(templates ?? []).map((t) => (
            <SequenceCard
              key={t.id}
              name={`${t.name} · clone`}
              description={t.description}
              steps={t.steps as unknown as SequenceStep[]}
              href={`/sequences/new?from=${t.id}`}
              meta="template"
              active={false}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function SequenceCard({
  name,
  description,
  steps,
  href,
  meta,
  active,
}: {
  name: string
  description: string | null
  steps: SequenceStep[]
  href: string
  meta: string
  active: boolean
}) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order)
  return (
    <Link
      href={href}
      className="group rounded-lg border border-hairline bg-surface p-5 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-display text-lg text-ink group-hover:text-moss">{name}</div>
        {active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/30 bg-moss-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-moss">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" /> live
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      <div className="mt-4 flex items-center gap-1.5">
        {sorted.map((s) => (
          <TonePill key={s.id} tone={s.tone} />
        ))}
        <span className="ml-auto font-mono text-[11px] text-faint">{meta}</span>
      </div>
    </Link>
  )
}