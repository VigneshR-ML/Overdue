export default function SettingsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded bg-hairline" />
        <div className="h-4 w-56 rounded bg-hairline" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-36 rounded-lg border border-hairline bg-surface" />
        <div className="h-36 rounded-lg border border-hairline bg-surface" />
        <div className="h-36 rounded-lg border border-hairline bg-surface" />
      </div>
      <div className="h-32 rounded-lg border border-hairline bg-surface" />
    </div>
  )
}
