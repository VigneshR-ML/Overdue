const EXAMPLE_FEEDBACK = [
  ["5.0", "The first reminder feels like me, not a robot.", "Creative studio owner"],
  ["4.5", "I can see who promised to pay and when I should follow up.", "Independent consultant"],
  ["4.0", "The CSV import got my overdue list into one place in minutes.", "Small agency founder"],
  ["5.0", "The ladder gives me a process instead of another spreadsheet.", "Brand strategist"],
  ["4.5", "A reply pausing the sequence is exactly the safety net I needed.", "Web designer"],
  ["5.0", "I stopped dreading Monday morning invoice checks.", "Video production owner"],
  ["4.0", "The timeline makes it obvious what happened on every invoice.", "Fractional CFO"],
  ["4.5", "The tone gets firmer without making the client relationship awkward.", "Marketing consultant"],
  ["5.0", "Being able to edit every message before it goes out is huge.", "Copywriting studio"],
  ["4.0", "It feels like a calm collections assistant, not a debt collector.", "Design agency owner"],
  ["4.5", "Promise dates are finally visible instead of buried in my inbox.", "IT services founder"],
  ["5.0", "The overdue queue tells me what actually needs my attention.", "Freelance developer"],
  ["4.0", "I can import from the system I already use without another integration project.", "Operations lead"],
  ["4.5", "The message preview gives me confidence before I send anything.", "Studio manager"],
  ["5.0", "The ladder is simple enough to set up between client calls.", "Creative director"],
  ["4.5", "It keeps follow-ups consistent when I am busy delivering the work.", "Content agency owner"],
  ["4.0", "The payment history view helps me choose who to contact first.", "Bookkeeping client"],
  ["5.0", "I finally have a repeatable way to ask for money politely.", "Brand designer"],
  ["4.5", "A client can ask for a date change without starting a long email thread.", "Consulting founder"],
  ["5.0", "The copy sounds human because I can make the final call.", "UX studio owner"],
  ["4.0", "I know which invoices are waiting on a promise and which are silent.", "Agency operations manager"],
  ["4.5", "It turns an uncomfortable task into a small daily checklist.", "Freelance photographer"],
  ["5.0", "The gentle-to-firm progression makes sense to my clients.", "Product studio founder"],
  ["4.0", "The ledger is much clearer than tracking sent messages manually.", "Independent architect"],
  ["4.5", "I can hand the follow-up process to a teammate without explaining everything.", "Small business owner"],
  ["5.0", "Seeing the next scheduled step removes a lot of guesswork.", "PR consultant"],
  ["4.5", "The workflow respects that a late client is not always a bad client.", "Creative services owner"],
  ["4.0", "The imported amounts and currencies stay easy to check.", "Digital agency founder"],
  ["5.0", "It gives me a professional follow-up habit without sounding formal.", "Independent strategist"],
  ["4.5", "The recovery flow is clear enough that I could set it up on my phone.", "Solo studio owner"],
] as const

function Rating({ value }: { value: string }) {
  const rating = Number(value)
  return (
    <div className="flex items-center gap-2" aria-label={`${value} out of 5 stars`}>
      <span className="flex tracking-[0.08em] text-brass" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const filled = rating >= index + 1
          const half = !filled && rating >= index + 0.5
          return (
            <span
              key={index}
              className={half ? "bg-gradient-to-r from-brass from-50% to-faint to-50% bg-clip-text text-transparent" : filled ? "" : "text-faint/50"}
            >
              ★
            </span>
          )
        })}
      </span>
      <span className="font-mono text-[10px] text-muted">{value}</span>
    </div>
  )
}

function FeedbackCard({ item, index }: { item: (typeof EXAMPLE_FEEDBACK)[number]; index: number }) {
  return (
    <article
      className="w-[274px] shrink-0 rounded-xl border border-white/70 bg-surface/65 p-4 shadow-ledger backdrop-blur-md sm:w-[310px]"
      aria-label={`Illustrative feedback ${index + 1}`}
    >
      <Rating value={item[0]} />
      <p className="mt-3 min-h-[3.75rem] text-[13px] leading-relaxed text-ink-soft">“{item[1]}”</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{item[2]}</p>
    </article>
  )
}

export function TestimonialMarquee() {
  const firstRow = EXAMPLE_FEEDBACK.slice(0, 15)
  const secondRow = EXAMPLE_FEEDBACK.slice(15)

  return (
    <section aria-labelledby="feedback-heading" className="relative overflow-hidden border-y border-hairline bg-surface/55 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">The feeling we are designing for</div>
          <h2 id="feedback-heading" className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Less chasing. More breathing room.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Illustrative feedback from the kinds of teams Overdue is built for. Replace these examples with verified customer quotes as your pilots come in.
          </p>
        </div>
      </div>

      <div className="relative mt-10 space-y-4">
        <div className="testimonial-edge testimonial-edge-left" aria-hidden="true" />
        <div className="testimonial-edge testimonial-edge-right" aria-hidden="true" />
        <div className="testimonial-track testimonial-track-left">
          {[...firstRow, ...firstRow].map((item, index) => (
            <FeedbackCard key={`first-${index}`} item={item} index={index % firstRow.length} />
          ))}
        </div>
        <div className="testimonial-track testimonial-track-right">
          {[...secondRow, ...secondRow].map((item, index) => (
            <FeedbackCard key={`second-${index}`} item={item} index={index % secondRow.length} />
          ))}
        </div>
      </div>
    </section>
  )
}
