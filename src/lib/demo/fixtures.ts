/**
 * Demo workspace fixtures.
 *
 * When Supabase isn't connected yet (no NEXT_PUBLIC_SUPABASE_URL / anon key),
 * the whole app runs in demo mode against local, deterministic fixtures so the
 * UI can be explored on localhost without any accounts. Once env vars are set,
 * everything flips to the real database automatically.
 */

export const DEMO_USER = { id: "demo-user", email: "demo@ledger.app" }

export function isDemoMode() {
  if (typeof window !== "undefined") {
    return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

// ── deterministic relative dates ────────────────────────────────────────────
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const stamp = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

// ── clients ─────────────────────────────────────────────────────────────────
export const DEMO_CLIENTS = [
  { id: "cl-rowan", user_id: DEMO_USER.id, name: "Rowan Interiors", email: "ap@rowaninteriors.com", billing_email: "ap@rowaninteriors.com" },
  { id: "cl-atlas", user_id: DEMO_USER.id, name: "Atlas & Finch Co", email: "finance@atlasfinch.com", billing_email: "finance@atlasfinch.com" },
  { id: "cl-harbor", user_id: DEMO_USER.id, name: "Harborline Creative", email: "hello@harborline.co", billing_email: "ap@harborline.co" },
  { id: "cl-march", user_id: DEMO_USER.id, name: "March & Co Studio", email: "billing@marchco.com", billing_email: "billing@marchco.com" },
  { id: "cl-vellum", user_id: DEMO_USER.id, name: "Vellum Press", email: "accounts@vellum.press", billing_email: "accounts@vellum.press" },
  { id: "cl-olive", user_id: DEMO_USER.id, name: "Olive Branch Studio", email: "ops@olivebranch.studio", billing_email: "ops@olivebranch.studio" },
] as const

export const DEMO_CLIENT_SCORES = [
  { ...DEMO_CLIENTS[0], score: 22, avgDays: 26 },
  { ...DEMO_CLIENTS[1], score: 43, avgDays: 19 },
  { ...DEMO_CLIENTS[2], score: 73, avgDays: 9 },
  { ...DEMO_CLIENTS[3], score: 100, avgDays: -2 },
  { ...DEMO_CLIENTS[4], score: 100, avgDays: -5 },
  { ...DEMO_CLIENTS[5], score: 84, avgDays: 3 },
] as const

// ── invoices ────────────────────────────────────────────────────────────────
const INV = (
  id: string,
  number: string,
  provider: string,
  provider_id: string,
  client_id: string,
  amount_cents: number,
  dueInDays: number,
  status: "paid" | "overdue" | "sent" | "pending" | "partially_paid",
  paid_cents = 0,
  paidInDays?: number,
) => ({
  id,
  user_id: DEMO_USER.id,
  number,
  provider,
  provider_id,
  client_id,
  amount_cents,
  paid_cents,
  currency: "USD",
  status,
  due_date: day(dueInDays),
  paid_at: paidInDays === undefined ? null : stamp(paidInDays),
  created_at: stamp(dueInDays - 14),
})

export const DEMO_INVOICES = [
  // Paid this month → "collected month" figure
  INV("inv-vellum-1", "INV-2024-0911", "xero", "inv_ert77", "cl-vellum", 185000, -12, "paid", 185000, -6),
  INV("inv-olive-1", "INV-2024-0908", "stripe", "in_1QoX3sDkMt", "cl-olive", 240000, -20, "paid", 240000, -3),
  INV("inv-march-1", "INV-2024-0905", "manual", "manual-14", "cl-march", 112000, -5, "paid", 112000, 0),
  // Overdue → on the ladder
  INV("inv-rowan-1", "INV-2024-0887", "xero", "inv_ert12", "cl-rowan", 340000, -28, "overdue"),
  INV("inv-rowan-2", "INV-2024-0879", "manual", "manual-9", "cl-rowan", 520000, -34, "partially_paid", 100000),
  INV("inv-atlas-1", "INV-2024-0894", "paypal", "PAY-8XKQ", "cl-atlas", 215000, -19, "overdue"),
  INV("inv-harbor-1", "INV-2024-0899", "stripe", "in_1QoWq2LkMt", "cl-harbor", 98000, -14, "overdue"),
  INV("inv-harbor-2", "INV-2024-0906", "stripe", "in_1QpA5xLkMt", "cl-harbor", 205000, -12, "overdue"),
  INV("inv-rowan-3", "INV-2024-0904", "xero", "inv_ert42", "cl-rowan", 167500, -9, "overdue"),
  // Due soon / pending
  INV("inv-march-2", "INV-2024-0912", "manual", "manual-15", "cl-march", 86000, 3, "sent"),
  INV("inv-vellum-2", "INV-2024-0913", "xero", "inv_ert91", "cl-vellum", 132000, 6, "sent"),
  INV("inv-olive-2", "INV-2024-0915", "stripe", "in_1QrB8qLkMt", "cl-olive", 64000, 9, "sent"),
  INV("inv-atlas-2", "INV-2024-0914", "paypal", "PAY-9XRQ", "cl-atlas", 277500, 12, "sent"),
] as const

// ── ladders & runs ──────────────────────────────────────────────────────────
export const DEMO_STEPS_STANDARD = [
  { id: "g", step_order: 1, delay_days: 1, tone: "gentle", ai_enabled: true, subject_template: "Just checking in on invoice {invoice_number}", body_template: "Hey {client_name}, checking in on {invoice_number} ({amount}) — let me know if there's anything you need." },
  { id: "n", step_order: 2, delay_days: 7, tone: "nudge", ai_enabled: true, subject_template: "Friendly reminder: invoice {invoice_number}", body_template: "Hi {client_name}, this is a friendly reminder that {invoice_number} ({amount}) is now {days_overdue} days past due." },
  { id: "f", step_order: 3, delay_days: 7, tone: "firm", ai_enabled: true, subject_template: "Invoice {invoice_number} — can you confirm receipt?", body_template: "Hi {client_name}, I haven't seen a payment for {invoice_number} ({amount}). Can you confirm it went through?" },
  { id: "x", step_order: 4, delay_days: 7, tone: "final", ai_enabled: true, subject_template: "Final notice: invoice {invoice_number}", body_template: "Hi {client_name}, this is the final notice for {invoice_number} ({amount}), now {days_overdue} days overdue." },
] as const

export const DEMO_STEPS_FAST = [
  { id: "f", step_order: 1, delay_days: 3, tone: "firm", ai_enabled: true, subject_template: "Settlement needed: invoice {invoice_number}", body_template: "Hi {client_name}, following up on {invoice_number} ({amount}). Please settle within 5 days." },
  { id: "x", step_order: 2, delay_days: 5, tone: "final", ai_enabled: true, subject_template: "Final notice: invoice {invoice_number}", body_template: "Hi {client_name}, final notice for {invoice_number} ({amount}). Payment is required within 3 days." },
] as const

export const DEMO_SEQUENCES = [
  {
    id: "seg-demo-std",
    user_id: DEMO_USER.id,
    name: "Standard Recovery Ladder",
    description: "The default: gentle first, final by day 22. Runs automatically on overdue invoices.",
    is_active: true,
    is_template: false,
    steps: DEMO_STEPS_STANDARD,
    runs: [{ id: "r1" }, { id: "r2" }, { id: "r3" }, { id: "r4" }, { id: "r5" }, { id: "r6" }],
    created_at: stamp(-40),
  },
  {
    id: "seg-demo-fast",
    user_id: DEMO_USER.id,
    name: "Fast Cash Ladder",
    description: "Two firmer rungs and an early deadline — for clients who need a harder nudge.",
    is_active: false,
    is_template: false,
    steps: DEMO_STEPS_FAST,
    runs: [{ id: "r7" }],
    created_at: stamp(-12),
  },
] as const

export const DEMO_TEMPLATES = [
  {
    id: "tpl-gentle",
    user_id: "system",
    name: "Gentle Standard Ladder",
    description: "Softest onboarding: four rungs, polite throughout, final deadline on day 22.",
    is_active: true,
    is_template: true,
    steps: DEMO_STEPS_STANDARD,
    created_at: stamp(-90),
  },
  {
    id: "tpl-fast",
    user_id: "system",
    name: "Friendly Final Ladder",
    description: "Two rungs, short deadline — for clients who respect a clear boundary.",
    is_active: true,
    is_template: true,
    steps: DEMO_STEPS_FAST,
    created_at: stamp(-90),
  },
] as const

export function demoTemplates() {
  return DEMO_TEMPLATES as unknown as Array<{
    id: string
    name: string
    description: string | null
    steps: Record<string, unknown>[]
    is_template: boolean
    user_id: string
    created_at: string
  }>
}

export function demoSequences() {
  return DEMO_SEQUENCES as unknown as Array<{
    id: string
    name: string
    description: string | null
    steps: Record<string, unknown>[]
    is_active: boolean
    is_template: boolean
    user_id: string
    runs: { id: string }[]
    created_at: string
  }>
}

export function demoSequenceById(id: string) {
  const all = [...DEMO_SEQUENCES, ...DEMO_TEMPLATES]
  return all.find((s) => s.id === id) ?? null
}

export function demoProfile() {
  return { id: DEMO_USER.id, full_name: "Avery Stone", email: DEMO_USER.email, onboarding_completed: true }
}

export function demoSubscription() {
  return { user_id: DEMO_USER.id, plan: "pro", status: "active", period_ends_at: null }
}