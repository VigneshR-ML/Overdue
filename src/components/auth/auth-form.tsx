"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { cn } from "@/lib/utils/format"

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  // Recovery links land on /login with a code/token_hash + type=recovery.
  const [recovery, setRecovery] = useState(() => {
    if (mode !== "login" || typeof window === "undefined") return false
    const sp = new URLSearchParams(window.location.search)
    return sp.get("type") === "recovery" && Boolean(sp.get("code") || sp.get("token_hash"))
  })
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")

  async function signInWithGoogle() {
    if (!isConfigured()) {
      setError("Supabase isn't configured on this deploy yet.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?source=google`,
          queryParams: { prompt: "select_account" },
        },
      })
      if (error) setError(error.message)
    } catch {
      setError("Couldn't reach the sign-in service. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (!isConfigured()) {
      setError(
        "Supabase isn't configured on this deploy yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )
      return
    }

    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) {
          if (/send confirmation email|smtp|email/i.test(error.message) && !/invalid/i.test(error.message)) {
            return setError("We couldn't send the confirmation email — your Supabase project's email provider isn't configured yet. Please ask support to enable email sending (or turn off email confirmation).")
          }
          return setError(error.message)
        }
        if (data.session) {
          // Hard navigation (not router.push): guarantees the fresh session
          // cookies hit middleware + server components instead of serving a
          // stale router-cached /dashboard that bounces back to landing.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/onboarding")
        } else {
          setMagicSent(true)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return setError(error.message)
        if (data.session) {
          // A full navigation makes the new auth cookies visible to server components.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/dashboard")
        } else {
          setError("Your email hasn't been confirmed yet. Please check your inbox for the confirmation link, or sign up again.")
        }
      }
    } catch {
      setError("Couldn't reach the sign-in service. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword() {
    if (!resetEmail) {
      setError("Enter your email first.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) return setError(error.message)
      setResetSent(true)
    } catch {
      setError("Couldn't send the reset link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  /** Recovery link → exchange token, then let the session update the password. */
  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError("Passwords don't match.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const sp = new URLSearchParams(window.location.search)
      const code = sp.get("code")
      const tokenHash = sp.get("token_hash")

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        if (error) throw new Error(error.message)
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw new Error(error.message)
      } else {
        throw new Error("Missing reset code — request a new link and follow it in the same browser.")
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)

      // Signed in with the fresh password now — drop the code and head in.
      window.location.replace("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed. Please try again.")
      setLoading(false)
    }
  }

  function backToSignIn() {
    setResetSent(false)
    setShowReset(false)
    setResetEmail("")
    setError(null)
  }

  if (resetSent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Check your inbox — we sent a password reset link. It can take a minute.
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={backToSignIn}>
          Back to sign in
        </Button>
      </div>
    )
  }

  if (recovery) {
    return (
      <form onSubmit={submitNewPassword} className="space-y-4">
        <p className="text-sm text-muted">Choose a new password for your account.</p>
        <Field label="New password" hint="min 8 characters">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error ? (
          <div className={cn("rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson")} role="alert">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Saving…" : "Set new password"}
        </Button>
      </form>
    )
  }

  if (mode === "login" && showReset) {
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
          <div className={cn("rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson")} role="alert">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={backToSignIn}>
          Back to sign in
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {magicSent ? (
        <div className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Check your inbox — we sent a confirmation link to <strong>{email}</strong>.
          It can take a minute; if it&apos;s not there, check spam or promotions.
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

      <Field label="Password" hint={mode === "login" ? undefined : "min 8 characters"}>
        <Input
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error ? (
        <div className={cn("rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson")} role="alert">
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
          onClick={() => { setShowReset(true); setResetEmail(email); setError(null) }}
          className="block w-full text-center text-sm text-moss hover:text-moss-bright"
        >
          Forgot your password?
        </button>
      )}
    </form>
  )
}
