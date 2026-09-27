"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/auth/password"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"

type LinkState = "checking" | "ready" | "invalid"

const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

export function SetPasswordForm() {
  const [linkState, setLinkState] = useState<LinkState>(authConfigured ? "checking" : "invalid")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(
    authConfigured ? null : "The sign-in service is not configured on this deployment.",
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authConfigured) return

    const supabase = createClient()
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        setLinkState(!sessionError && data.session ? "ready" : "invalid")
      })
      .catch(() => {
        setError("Could not verify this link. Request a new one and try again.")
        setLinkState("invalid")
      })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }

      window.location.replace("/dashboard")
    } catch {
      setError("Could not save your password. Please request a new link and try again.")
    } finally {
      setLoading(false)
    }
  }

  if (linkState === "checking") {
    return <p className="text-sm text-muted">Checking your secure link...</p>
  }

  if (linkState === "invalid") {
    return (
      <div className="space-y-4">
        <div role="alert" className="rounded-md border border-rust/40 bg-rust/10 p-4 text-sm text-crimson">
          {error ?? "This link is invalid or has expired. Request a new link to continue."}
        </div>
        <div className="grid gap-3">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Password" hint={PASSWORD_REQUIREMENTS}>
        <Input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="10+ characters"
        />
      </Field>
      <Field label="Confirm password">
        <Input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Enter it again"
        />
      </Field>
      {error ? (
        <div role="alert" className="rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
          {error}
        </div>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Saving..." : "Save password and continue"}
      </Button>
    </form>
  )
}
