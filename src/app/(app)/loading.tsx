/**
 * Route-level skeleton for the whole workspace. The top bar and dock live in
 * the shared layout and stay mounted during navigation — this toasts that a
 * route is on its way the instant it's tapped.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-hairline" />
          <div className="h-8 w-52 rounded bg-hairline" />
          <div className="h-3 w-80 rounded bg-hairline" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-hairline" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-hairline bg-surface p-4">
            <div className="h-4 w-24 rounded bg-hairline" />
            <div className="mt-3 h-8 w-32 rounded bg-hairline" />
            <div className="mt-3 h-3 w-full rounded bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  )
}