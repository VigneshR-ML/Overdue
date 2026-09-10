"use client"

import { useState } from "react"

export function CopyEmailButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
          } else {
            // Fallback for non-secure contexts
            const textarea = document.createElement("textarea")
            textarea.value = text
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand("copy")
            textarea.remove()
          }
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        } catch {
          // Clipboard failure is silent
        }
      }}
      className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss transition-colors hover:text-moss-bright"
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  )
}