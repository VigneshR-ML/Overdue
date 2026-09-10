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
  const [resetSent, setResetSent] = useState(false)
  const [resetEmail, setResetEmail] = useState("")

  async function signInWithGoogle() {
    const supabase = createClient()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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

  async function resetPassword() {
    if (!resetEmail) return
    const supabase = createClient()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) return setError(error.message)
    setResetSent(true)
  }

  if (resetSent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Check your inbox — we sent a password reset link.
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => { setResetSent(false) }}>
          Back to sign in
        </Button>
      </div>
    )
  }

  if (mode === "login" && resetEmail) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); resetPassword() }} className="space-y-4">
        <p className="text-sm text-muted">Enter your email and we&apos;ll send a reset link.</p>
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="you@studio.com"
          />
        </Field>
        {error ? (
          <div className={cn("rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson")}>
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setResetEmail("")}>
          Back to sign in
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {magicSent ? (
        <div className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Check your inbox — if this account exists we just sent you a confirmation link.
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={loading}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-hairline" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">or with email</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

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

      {mode === "login" && (
        <button
          type="button"
          onClick={() => { setResetEmail(email); setError(null) }}
          className="block w-full text-center text-sm text-moss hover:text-moss-bright"
        >
          Forgot your password?
        </button>
      )}
    </form>
  )
}