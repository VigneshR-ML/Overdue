"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

/**
 * Shown on /login and /signup while Supabase isn't configured. Instead of a
 * dead auth form, drop the visitor straight into the demo workspace.
 */
export function DemoGate() {
  return (
    <div className="space-y-4 rounded-lg border border-ember/40 bg-ember/10 p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ember">
        Demo mode — no account needed
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">
        Supabase isn't connected on this deploy yet, so authentication is off. Walk the whole
        product on seeded fixtures instead.
      </p>
      <Link href="/dashboard" className="block">
        <Button className="w-full" size="lg" variant="ink">
          Explore the demo workspace <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  )
}