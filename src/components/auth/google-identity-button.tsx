"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"

type GoogleCredentialResponse = {
  credential?: string
  error?: string
  error_description?: string
}

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    nonce?: string
  }) => void
  renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

function createNonce(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function hashNonce(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  // Google puts this hashed nonce in the ID token. Supabase verifies it by
  // hashing the raw nonce with SHA-256 and comparing the lowercase hex form.
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function GoogleIdentityButton({
  disabled,
  onCredential,
  onError,
}: {
  disabled?: boolean
  onCredential: (token: string, nonce: string) => void
  onError: (message: string) => void
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const nonceRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(() =>
    typeof window !== "undefined" && Boolean(window.google?.accounts?.id),
  )
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    const googleId = window.google?.accounts?.id
    if (!scriptReady || !googleId || !buttonRef.current || !clientId) return

    const nonce = createNonce()
    nonceRef.current = nonce
    let cancelled = false

    void hashNonce(nonce).then((hashedNonce) => {
      if (cancelled || !buttonRef.current) return
      googleId.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        callback: (response) => {
          if (response.error || !response.credential) {
            onError(response.error_description ?? "Google sign-in was cancelled.")
            return
          }
          const rawNonce = nonceRef.current
          if (!rawNonce) {
            onError("Google sign-in expired. Please try again.")
            return
          }
          onCredential(response.credential, rawNonce)
        },
      })
      buttonRef.current.replaceChildren()
      googleId.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 350,
      })
    })

    return () => {
      cancelled = true
      googleId.cancel()
    }
  }, [clientId, onCredential, onError, scriptReady])

  if (!clientId) {
    return (
      <div className="space-y-2" role="group" aria-label="Google sign in">
        <button
          type="button"
          disabled
          className="flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-paper px-4 text-sm font-medium text-muted opacity-70"
        >
          Continue with Google
        </button>
        <p className="rounded-md border border-ember/40 bg-ember/10 p-3 text-[13px] text-ink-soft" role="alert">
          Google sign-in is not configured on this deployment yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel and redeploy.
        </p>
      </div>
    )
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""} aria-busy={disabled}>
      <Script
        id="google-identity-services"
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onError("Could not load Google sign-in. Please try again.")}
      />
      <div ref={buttonRef} className="flex min-h-11 justify-center" />
    </div>
  )
}
