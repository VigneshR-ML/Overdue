import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPlanPortalToken } from "@/lib/recovery/token"
import { Wordmark } from "@/components/marketing/site"
import { formatDate, formatMoney } from "@/lib/utils/format"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payment plan", robots: { index: false, follow: false } }

type Installment = {
  amount_cents: number
  due_date: string
  status: string
  checkout_attempts?: { url: string | null; status: string; expires_at: string | null }[]
}

export default async function PlanPortalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const verified = verifyPlanPortalToken(token)
  if (!verified) notFound()

  const supabase = createAdminClient()
  if (!supabase) notFound()

  const { data: plan } = await supabase
    .from("payment_plans")
    .select("id, status, total_cents, currency, frequency, starts_on, invoices(number, status, paid_at), plan_installments(amount_cents, due_date, status, checkout_attempts(url, status, expires_at))")
    .eq("id", verified.planId)
    .maybeSingle()
  if (!plan) notFound()

  const invoice = Array.isArray(plan.invoices) ? plan.invoices[0] : plan.invoices
  const installments = ((plan.plan_installments ?? []) as Installment[])
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const isPaid = invoice?.status === "paid" || Boolean(invoice?.paid_at)
  const isClosed = ["cancelled", "declined", "expired"].includes(String(plan.status))

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-xl items-center px-5"><Wordmark /></div>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 py-10">
        <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-moss">Payment plan</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            {isPaid ? "Invoice paid — thank you." : invoice?.number ? `Invoice ${invoice.number}` : "Your payment schedule"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {isPaid
              ? "No further action is needed."
              : isClosed
                ? "This payment plan is no longer active. Please contact the business if you need help."
                : `Total scheduled: ${formatMoney(Number(plan.total_cents), String(plan.currency ?? "USD").toUpperCase())}. Pay each installment from its secure payment link when it is due.`}
          </p>
        </section>

        <section className="mt-5 overflow-hidden rounded-xl border border-hairline bg-white">
          <div className="border-b border-hairline px-5 py-4">
            <h2 className="font-medium text-ink">Schedule</h2>
          </div>
          <ul className="divide-y divide-hairline">
            {installments.map((installment, index) => {
              const checkout = (installment.checkout_attempts ?? []).find((attempt) =>
                attempt.status === "open" &&
                attempt.url &&
                (!attempt.expires_at || new Date(attempt.expires_at).getTime() > Date.now()),
              )
              const settled = ["paid", "waived"].includes(installment.status)
              return (
                <li key={`${installment.due_date}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium text-ink">Installment {index + 1}</p>
                    <p className="mt-1 text-sm text-ink-muted">{formatDate(installment.due_date)} · {installment.status.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-medium text-ink">{formatMoney(Number(installment.amount_cents), String(plan.currency ?? "USD").toUpperCase())}</span>
                    {!isPaid && !isClosed && !settled && checkout?.url ? (
                      <a className="rounded-md bg-moss px-3 py-2 text-sm font-medium text-white hover:bg-moss/90" href={checkout.url}>Pay now</a>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
        {!isPaid && !isClosed ? <p className="mt-5 text-center text-sm text-ink-muted">For security, payment links can expire. Your next reminder includes a fresh secure link.</p> : null}
      </main>
    </div>
  )
}
