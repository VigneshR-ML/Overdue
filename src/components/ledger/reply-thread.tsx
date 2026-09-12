import { formatDate, formatMoney } from "@/lib/utils/format"
import { REPLY_CLASS_META } from "@/lib/ai/reply"
import type { ReplyThreadItem, OpenDisputeRow } from "@/lib/db/queries"

/**
 * The reply thread — client emails classified as they arrive, with the
 * extracted facts (promise date, disputed amount) and the confidence behind
 * each call. Rendering the human's words next to the machine's verdict keeps
 * the AI honest: you can always read what it decided and why.
 */
export function ReplyThread({
  replies,
  disputes,
}: {
  replies: ReplyThreadItem[]
  disputes: OpenDisputeRow[]
}) {
  if (replies.length === 0 && disputes.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
      <div className="border-b border-hairline bg-paper/60 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Reply thread <span className="text-faint">/ what the client said, what we did</span>
      </div>

      {disputes.length > 0 && (
        <ul className="divide-y divide-hairline border-b border-hairline bg-crimson/[0.03]">
          {disputes.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <span className="rounded-full border border-crimson/30 bg-crimson/10 px-2.5 py-1 font-mono text-[11px] text-crimson">
                Open dispute
              </span>
              <span className="text-[13px] font-medium text-ink">{d.category}</span>
              {d.amount_cents ? <span className="font-mono text-[12px] text-muted">on {formatMoney(d.amount_cents)}</span> : null}
              {d.reason ? <span className="min-w-0 flex-1 truncate text-[12px] text-muted" title={d.reason}>{d.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {replies.length > 0 && (
        <ul className="divide-y divide-hairline">
          {replies.map((r) => {
            const meta = REPLY_CLASS_META[r.classification as keyof typeof REPLY_CLASS_META]
            return (
              <li key={r.id} className="space-y-1.5 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {meta ? (
                    <span
                      className="rounded-full border px-2.5 py-1 font-mono text-[11px]"
                      style={{ color: meta.color, borderColor: meta.border, background: `${meta.color}0D` }}
                    >
                      {meta.label}
                    </span>
                  ) : (
                    <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] text-muted">{r.classification}</span>
                  )}
                  <span className="font-mono text-[11px] text-faint">
                    {r.confidence}% confident · {r.source}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-faint">{formatDate(r.created_at)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-[12px]">
                  {r.extracted_date ? <span className="text-ink-soft">promised by <span className="text-ink">{formatDate(r.extracted_date)}</span></span> : null}
                  {r.amount_cents ? <span className="text-ink-soft">amount <span className="text-ink">{formatMoney(r.amount_cents)}</span></span> : null}
                </div>

                {r.raw_text ? (
                  <p className="border-l-2 border-hairline pl-3 text-[13px] leading-relaxed text-muted">{r.raw_text}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}