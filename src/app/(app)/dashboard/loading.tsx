export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-hairline" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-hairline bg-surface p-4">
            <div className="h-3 w-24 rounded bg-hairline mb-2" />
            <div className="h-6 w-16 rounded bg-hairline" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-hairline bg-surface p-4" />
        ))}
      </div>
    </div>
  )
}
