export default function InvoicesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded bg-hairline" />
      <div className="flex gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-16 rounded-full bg-hairline" />
        ))}
      </div>
      <div className="rounded-lg border border-hairline bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline px-5 py-3">
            <div className="h-4 w-28 rounded bg-hairline" />
            <div className="h-4 w-20 rounded bg-hairline" />
            <div className="h-4 w-16 rounded bg-hairline ml-auto" />
            <div className="h-4 w-20 rounded bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  )
}
