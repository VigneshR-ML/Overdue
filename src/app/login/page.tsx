import type { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/login" },
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-sm items-center px-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-16">
        <h1 className="font-display text-3xl tracking-tight text-ink">
          Welcome back to the <em className="italic">ledger.</em>
        </h1>
        <p className="mt-2 text-sm text-muted">Sign in to pick up where your invoices left off.</p>
        <div className="mt-8">
          <AuthForm mode="login" />
        </div>
        <div className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-moss hover:text-moss-bright">
            Create a free account
          </Link>
        </div>
      </main>
    </div>
  )
}