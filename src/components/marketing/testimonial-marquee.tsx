const EXAMPLE_FEEDBACK = [
  ["5.0", "The first reminder feels like me, not a robot.", "Maya Collins", "Northline Creative"],
  ["4.5", "I can see who promised to pay and when I should follow up.", "Daniel Brooks", "Harbor Advisory"],
  ["4.0", "The CSV import got my overdue list into one place in minutes.", "Sophie Turner", "Brightfield Studio"],
  ["5.0", "The ladder gives me a process instead of another spreadsheet.", "Marcus Reed", "Oak & Signal"],
  ["4.5", "A reply pausing the sequence is exactly the safety net I needed.", "Lena Foster", "Pixel & Pine"],
  ["5.0", "I stopped dreading Monday morning invoice checks.", "Ethan Cole", "Framehouse Media"],
  ["4.0", "The timeline makes it obvious what happened on every invoice.", "Nora Bennett", "Ledger Lane Advisory"],
  ["4.5", "The tone gets firmer without making the client relationship awkward.", "Caleb Morgan", "Clearpath Marketing"],
  ["5.0", "Being able to edit every message before it goes out is huge.", "Avery Scott", "Kindred Copy Co."],
  ["4.0", "It feels like a calm collections assistant, not a debt collector.", "Jordan Hayes", "West & Wilder"],
  ["4.5", "Promise dates are finally visible instead of buried in my inbox.", "Ryan Mitchell", "Orbitline IT"],
  ["5.0", "The overdue queue tells me what actually needs my attention.", "Chloe Parker", "Parker Web Studio"],
  ["4.0", "I can import from the system I already use without another integration project.", "Nathan Gray", "Southbank Ops"],
  ["4.5", "The message preview gives me confidence before I send anything.", "Emma Wallace", "Morrow Studio"],
  ["5.0", "The ladder is simple enough to set up between client calls.", "Lucas Grant", "Signalhouse Creative"],
  ["4.5", "It keeps follow-ups consistent when I am busy delivering the work.", "Isla Murphy", "Storywell Agency"],
  ["4.0", "The payment history view helps me choose who to contact first.", "Noah Price", "Cedar Bookkeeping"],
  ["5.0", "I finally have a repeatable way to ask for money politely.", "Grace Kim", "Fieldnote Brand Co."],
  ["4.5", "A client can ask for a date change without starting a long email thread.", "Owen Carter", "Carter & Rowe"],
  ["5.0", "The copy sounds human because I can make the final call.", "Mia Lawson", "Softline UX"],
  ["4.0", "I know which invoices are waiting on a promise and which are silent.", "Jack Bennett", "Hearthside Agency"],
  ["4.5", "It turns an uncomfortable task into a small daily checklist.", "Ella Dawson", "Dawson Photo Co."],
  ["5.0", "The gentle-to-firm progression makes sense to my clients.", "Theo Martin", "Foundry Product Studio"],
  ["4.0", "The ledger is much clearer than tracking sent messages manually.", "Anna Rivera", "Rivermark Architecture"],
  ["4.5", "I can hand the follow-up process to a teammate without explaining everything.", "Ben Cooper", "Copperline Works"],
  ["5.0", "Seeing the next scheduled step removes a lot of guesswork.", "Sienna Hughes", "Northstar PR"],
  ["4.5", "The workflow respects that a late client is not always a bad client.", "Luke Harris", "Common Ground Creative"],
  ["4.0", "The imported amounts and currencies stay easy to check.", "Zoe Sanders", "Violet Peak Digital"],
  ["5.0", "It gives me a professional follow-up habit without sounding formal.", "Henry Cole", "Quiet Signal Strategy"],
  ["4.5", "The recovery flow is clear enough that I could set it up on my phone.", "Ruby Allen", "Little Atlas Studio"],
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
      <div className="mt-3"><p className="text-[12px] font-medium text-ink">{item[2]}</p><p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{item[3]}</p></div>
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

      <div className="testimonial-marquee relative mt-10 space-y-4">
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
