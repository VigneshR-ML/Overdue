"use client"

import { ErrorLedger } from "@/components/error-ledger"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorLedger error={error} reset={reset} />
}