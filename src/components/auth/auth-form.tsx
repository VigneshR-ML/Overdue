"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { cn } from "@/lib/utils/format"

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    const supabase = createClient()
    const isConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!isConfigured) {
      setError(
        "Supabase isn't configured on this deploy yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )
      return
    }

    setError(null)
    setLoading(true)

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      })
      setLoading(false)
      if (error) return setError(error.message)
      if (data.session) {
        router.push("/onboarding")
        router.refresh()
      } else {
        setMagicSent(true)
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) return setError(error.message)
      if (data.session) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError("Check your email for a confirmation link.")
      }
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {magicSent ? (
        <div className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Check your inbox — if this account exists we just sent you a confirmation link.
        </div>
      ) : null}

      <Field label="Email">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@studio.com"
        />
      </Field>

      <Field label="Password" hint="min 8 characters">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error ? (
        <div className={cn("rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson")}>
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
        Free plan · no card · cancel anytime
      </p>
    </form>
  )
}