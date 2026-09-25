export function AuthSideIllustration() {
  return (
    <aside className="relative hidden overflow-hidden border-l border-hairline bg-surface/60 px-10 py-12 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(47,93,80,0.12),transparent_42%),radial-gradient(circle_at_85%_80%,rgba(194,154,67,0.16),transparent_34%)]" />
      <div className="relative">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">The recovery loop</div>
        <h2 className="mt-4 max-w-md font-display text-4xl leading-tight tracking-tight text-ink">
          The money is late. <em className="italic text-moss">The relationship doesn&apos;t have to be.</em>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          Overdue keeps every follow-up calm, visible and ready for the next human decision.
        </p>
      </div>

      <div className="relative mt-12 rounded-2xl border border-white/80 bg-paper/70 p-5 shadow-ledger backdrop-blur-md" aria-label="Animated invoice recovery illustration">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Invoice recovery</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-moss"><span className="h-1.5 w-1.5 rounded-full bg-moss" /> live</span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-x-5">
          <div>
            <div className="font-mono text-[11px] text-muted">Northwind Creative · #0914</div>
            <div className="mt-1 font-display text-3xl text-ink">$2,400.00</div>
          </div>
          <div className="font-mono text-[11px] text-ember">day 16 · firm</div>
        </div>
        <div className="mt-6 flex h-28 items-end gap-2 border-b border-l border-hairline px-3 pb-0 pt-4">
          {["h-5", "h-9", "h-14", "h-20", "h-24"].map((height, index) => (
            <div key={height} className={`auth-bar ${height} flex-1 rounded-t-sm ${index < 2 ? "bg-moss/25" : index === 2 ? "bg-brass/60" : "bg-ember/70"}`} />
          ))}
          <div className="auth-chart-line" aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] text-faint">
          <span>gentle</span><span className="text-center">reply paused</span><span className="text-right text-moss">paid next</span>
        </div>
      </div>

      <div className="relative mt-8 grid grid-cols-3 gap-3">
        {[["01", "remind"], ["02", "listen"], ["03", "recover"]].map(([number, label]) => (
          <div key={number} className="rounded-lg border border-hairline bg-surface/70 p-3 backdrop-blur-sm">
            <div className="font-mono text-[10px] text-moss">{number}</div>
            <div className="mt-2 text-[12px] text-ink-soft">{label}</div>
          </div>
        ))}
      </div>
    </aside>
  )
}
