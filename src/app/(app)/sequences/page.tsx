import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getSequencesWithRuns, getTemplates } from "@/lib/db/queries"
import { TonePill } from "@/components/ledger/escalation-ladder"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app-shell/page-header"
import { Plus } from "lucide-react"
import type { SequenceStep } from "@/types"
import { AttachLadderButton } from "@/components/ledger/attach-ladder-button"

export const metadata = { title: "Ladders" }

export const dynamic = "force-dynamic"

export default async function SequencesPage(props: { searchParams?: Promise<{ error?: string; attachTo?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const userId = session.id

  const sequences = await getSequencesWithRuns(userId)
  const mine = sequences.filter((s) => s.user_id === userId && !s.is_template)

  const templates = await getTemplates()

  const errorBanner = searchParams?.error === "free-limit"
    ? "Free plan is limited to 1 ladder. Upgrade to Pro to add more."
    : searchParams?.error === "bad-template"
    ? "Couldn't load that template — try a different one."
    : null

  return (
    <div className="space-y-6">
      {errorBanner ? (
        <div role="alert" className="rounded-md border border-ember/40 bg-ember/10 p-4 text-sm text-ink-soft">
          {errorBanner}
        </div>
      ) : null}

      <PageHeader
        kicker="Escalation"
        title="Ladders"
        description="A ladder is a saved set of reminder emails. It starts only when you attach it to an invoice."
        action={
          <Link href="/sequences/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New ladder
            </Button>
          </Link>
        }
      />
      {searchParams?.attachTo ? <div className="rounded-lg border border-moss/30 bg-moss-soft p-4 text-sm text-ink-soft">Choose a ladder below. It will attach to this invoice, then return to its workflow.</div> : null}

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
        <div className="mt-3 grid gap-4">
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
                  attachTo={searchParams?.attachTo}
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
  attachTo,
}: {
  name: string
  description: string | null
  steps: SequenceStep[]
  href: string
  meta: string
  active: boolean
  attachTo?: string
}) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order)
  return (
    <div className="group rounded-lg border border-hairline bg-surface p-5 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="font-display text-lg text-ink group-hover:text-moss">{name}</div>
        {active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/30 bg-moss-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-moss">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" /> ready
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      <div className="mt-4 flex items-center gap-1.5">
        {sorted.map((s) => (
          <TonePill key={s.id} tone={s.tone} />
        ))}
        <span className="ml-auto font-mono text-[11px] text-faint">{meta.replace("active", "attached")}</span>
      </div>
      {attachTo ? <AttachLadderButton invoiceId={attachTo} sequenceId={href.split("/").pop()!} /> : <Link href={href} className="mt-3 inline-block text-[12px] font-medium text-moss hover:underline">Edit ladder →</Link>}
    </div>
  )
}
