export default function SequencesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded bg-hairline" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-hairline bg-surface p-4">
            <div className="h-4 w-40 rounded bg-hairline mb-2" />
            <div className="h-3 w-24 rounded bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  )
}