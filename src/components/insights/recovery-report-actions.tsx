"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type ShareStatus = "idle" | "shared" | "copied" | "error"

export function RecoveryReportActions({
  reportLines,
}: {
  reportLines: string[]
}) {
  const [status, setStatus] = useState<ShareStatus>("idle")
  const report = [
    "Overdue recovery report",
    ...reportLines,
    "Generated in Overdue.",
  ].join("\n")

  async function shareReport() {
    setStatus("idle")
    try {
      if (navigator.share) {
        await navigator.share({ title: "Overdue recovery report", text: report })
        setStatus("shared")
        return
      }
    } catch {
      // If the share sheet is dismissed, copying is still a useful fallback.
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = report
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand("copy")
        textarea.remove()
        if (!copied) throw new Error("Copy command was unavailable")
      }
      setStatus("copied")
    } catch {
      setStatus("error")
    }
  }

  const message = status === "shared"
    ? "Share sheet opened"
    : status === "copied"
      ? "Report copied"
      : status === "error"
        ? "Couldn’t copy—try again"
        : ""

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={shareReport}>
        <Share2 className="mr-2 h-4 w-4" /> Share recovery report
      </Button>
      <span aria-live="polite" className={`font-mono text-[11px] ${status === "error" ? "text-rust" : "text-moss"}`}>
        {message}
      </span>
    </div>
  )
}
