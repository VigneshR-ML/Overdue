"use client"

export function DownloadTemplateButton({ filename, text }: { filename: string; text: string }) {
  return <button type="button" onClick={() => { const blob = new Blob([text], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }} className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss hover:text-moss-bright"><span aria-hidden="true">↓</span> download</button>
}
