"use client"

import { useState } from "react"

export function CopyEmailButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
      className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss transition-colors hover:text-moss-bright"
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  )
}