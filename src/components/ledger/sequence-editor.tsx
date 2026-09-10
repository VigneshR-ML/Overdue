"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { renderTemplate } from "@/lib/ai/draft"
import { formatDate } from "@/lib/utils/format"
import type { SequenceStep, Tone } from "@/types"
import { TONE_META } from "@/types"
import { EscalationLadder } from "@/components/ledger/escalation-ladder"
import { Button } from "@/components/ui/button"
import { ToggleRow } from "@/components/ui/switch"
import { Field, Input, Textarea } from "@/components/ui/input"
import { cn } from "@/lib/utils/format"
import { Wand2, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"

const TONES: Tone[] = ["gentle", "nudge", "firm", "final"]

const openai = (k: string) => {
  const map: Record<Tone, [string, string]> = {
    gentle: ["Just checking in on invoice {invoice_number}", "Hi {client_name}, quick note that invoice {invoice_number} for {amount} was due on {due_date} — no rush, just making sure it didn't slip through.\n\nBest, {sender_name}"],
    nudge: ["Friendly reminder: invoice {invoice_number}", "Hi {client_name}, friendly ping on invoice {invoice_number} ({amount}), due {due_date}. If anything looks off, reply here and I'll sort it today.\n\nThanks, {sender_name}"],
    firm: ["{invoice_number} — can you confirm receipt?", "Hi {client_name}, invoice {invoice_number} for {amount} is now {days_overdue} days past due. Could you confirm a payment date? If it's in dispute, tell me now and we'll fix it.\n\nBest, {sender_name}"],
    final: ["Final notice: invoice {invoice_number}", "Hi {client_name}, this is the final reminder for invoice {invoice_number} ({amount}), now {days_overdue} days overdue. Unless payment is scheduled within 5 days, I'll pause work and escalate.\n\nThanks, {sender_name}"],
  }
  return map[k as Tone]
}

const SAMPLE = {
  client_name: "Arbor Studio",
  client_email: "billing@arbor.studio",
  invoice_number: "2026-0952",
  amount: "$1,120.50",
  due_date: formatDate("2026-08-12"),
  issue_date: formatDate("2026-07-28"),
  days_overdue: "8",
  sender_name: "You",
  company: "Overdue",
  paid_cents: "$0.00",
  balance: "$1,120.50",
}

export function SequenceEditor({
  id,
  initial,
  readOnly = false,
}: {
  id: string
  initial: { name: string; is_active: boolean; steps: SequenceStep[] }
  readOnly?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [isActive, setIsActive] = useState(initial.is_active)
  const [steps, setSteps] = useState<SequenceStep[]>(
    [...initial.steps].sort((a, b) => a.step_order - b.step_order),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
  }, [])

  const [selectedId, setSelectedId] = useState(steps[0]?.id)
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0]

  const renumbered = useMemo(
    () => steps.map((s, i) => ({ ...s, step_order: i + 1 })),
    [steps],
  )

  function patchSelected(patch: Partial<SequenceStep>) {
    setSteps((prev) => prev.map((s) => (s.id === (selected?.id ?? selectedId) ? { ...s, ...patch } : s)))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    setSteps((prev) => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function addStep() {
    if (steps.length >= 6) return
    const tone = TONES[Math.min(steps.length, TONES.length - 1)]
    const [subj, body] = openai(tone)
    const step: SequenceStep = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      step_order: steps.length + 1,
      delay_days: 7,
      tone,
      ai_enabled: true,
      subject_template: subj,
      body_template: body,
    }
    setSteps((prev) => [...prev, step])
    setSelectedId(step.id)
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return
    const next = steps.filter((_, idx) => idx !== i)
    setSteps(next)
    setSelectedId(next[Math.min(i, next.length - 1)]?.id)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/sequences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, is_active: isActive, steps: renumbered }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? "Save failed")
        return
      }
      setSaved(true)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(v: boolean) {
    setIsActive(v)
    try {
      const res = await fetch("/api/sequences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, is_active: v, steps: renumbered }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json?.error ?? "Save failed")
        setIsActive(!v)
      } else router.refresh()
    } catch {
      setError("Network error — please try again.")
      setIsActive(!v)
    }
  }

  const previewBody = renderTemplate(selected?.body_template ?? "", SAMPLE)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left column — the ladder + editor */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Field label="Ladder name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Ladder" />
            </Field>
          </div>
          {!readOnly && <ToggleRow title="Active" description="Attaching this ladder auto-runs it" checked={isActive} onChange={toggleActive} />}
          {!readOnly && (
            <Button onClick={save} disabled={saving} variant="moss" className="gap-2">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save ladder"}
            </Button>
          )}
        </div>

        {error ? <div className="rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">{error}</div> : null}

        <div className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
          <div className="mb-5 flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">The ladder</div>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={addStep} disabled={steps.length >= 6} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add rung
              </Button>
            )}
          </div>
          <EscalationLadder steps={renumbered} onStepClick={(s) => setSelectedId(s.id)} />
        </div>
      </div>

      {/* Right column — step editor + preview */}
      {selected ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                Edit rung {selected.step_order}
              </span>
              <div className="flex items-center gap-1">
                <IconBtn onClick={() => move(selected.step_order - 1, -1)} disabled={selected.step_order === 1} label="Move up"><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn onClick={() => move(selected.step_order - 1, 1)} disabled={selected.step_order === steps.length} label="Move down"><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn onClick={() => removeStep(selected.step_order - 1)} disabled={steps.length <= 1} label="Delete rung"><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Tone">
                <div className="grid grid-cols-2 gap-1.5">
                  {TONES.map((t) => {
                    const activeTone = selected.tone === t
                    const meta = TONE_META[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={activeTone}
                        onClick={() => patchSelected({ tone: t })}
                        className={cn(
                          "rounded-md border px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-150 cursor-pointer",
                          activeTone ? "text-white" : "text-muted hover:text-ink",
                        )}
                        style={{ borderColor: meta.border, background: activeTone ? meta.color : "transparent" }}
                      >
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Delay" hint="days">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={selected.delay_days}
                  onChange={(e) => patchSelected({ delay_days: Math.max(0, Number(e.target.value)) })}
                />
              </Field>
            </div>

            <div className="mt-4 space-y-4">
              <ToggleRow
                title="AI draft"
                description="Ask the model to rewrite this rung in your voice, facts kept exact"
                checked={selected.ai_enabled}
                onChange={(v) => patchSelected({ ai_enabled: v })}
              />
              <Field label="Subject">
                <Input
                  value={selected.subject_template}
                  onChange={(e) => patchSelected({ subject_template: e.target.value })}
                  placeholder="Just checking in on invoice {invoice_number}"
                  className="font-mono text-[13px]"
                />
              </Field>
              <Field label="Message body" hint="{amount} {due_date} {client_name}…">
                <Textarea
                  value={selected.body_template}
                  onChange={(e) => patchSelected({ body_template: e.target.value })}
                  className="font-sans text-[13px] leading-relaxed"
                  rows={9}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                <Wand2 className="h-3.5 w-3.5" /> Preview
              </span>
              <span className="font-mono text-[10px] text-faint">sample client · Arbors</span>
            </div>
            <div className="rounded-md border border-hairline bg-paper p-4">
              <div className="font-mono text-[11px] text-faint">subject</div>
              <div className="mt-0.5 text-[13px] font-medium text-ink">{renderTemplate(selected?.subject_template ?? "", SAMPLE)}</div>
              <div className="mt-3 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-soft">{previewBody}</div>
            </div>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
              Merge chips: {`{amount}`} {`{due_date}`} {`{client_name}`} {`{invoice_number}`} {`{days_overdue}`} {`{sender_name}`} — filled with exact facts at send time. AI keeps them honest.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-hairline p-5 text-sm text-muted">
          Add a rung to start building.
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-faint transition-colors hover:bg-paper hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
    >
      {children}
    </button>
  )
}