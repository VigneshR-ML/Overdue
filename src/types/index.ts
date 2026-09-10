export type Tone = "gentle" | "nudge" | "firm" | "final"

export type InvoiceStatus = "pending" | "sent" | "paid" | "partially_paid" | "overdue"

export interface Invoice {
  id: string
  user_id: string
  client_id: string | null
  provider: "stripe" | "paypal" | "xero" | "manual"
  provider_id: string | null
  number: string | null
  status: InvoiceStatus
  amount_cents: number
  paid_cents: number
  currency: string
  issue_date: string | null
  due_date: string | null
  paid_at: string | null
  line_item_summary: string | null
  payment_url?: string | null
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  billing_email: string | null
  payment_history_score: number | null
  avg_payment_days: number | null
  created_at: string
}

export interface SequenceStep {
  id: string
  step_order: number
  delay_days: number
  tone: Tone
  subject_template: string
  body_template: string
  ai_enabled: boolean
  is_template?: boolean
}

export interface Sequence {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  is_default: boolean
  is_template: boolean
  steps: SequenceStep[]
  created_at: string
  updated_at: string
}

export interface Run {
  id: string
  user_id: string
  sequence_id: string
  invoice_id: string
  current_step: number
  status: "queued" | "processing" | "sent" | "completed" | "paused" | "failed"
  next_run_at: string | null
  last_sent_at: string | null
  messages_sent: number
  attempt?: number
  failed_at?: string | null
  error?: string | null
  promise_date?: string | null
  promise_note?: string | null
  promise_amount_cents?: number | null
  updated_at?: string
  created_at: string
}

export interface Message {
  id: string
  user_id: string
  run_id: string | null
  invoice_id: string
  to_email: string
  subject: string
  body: string
  step: number
  tone: Tone
  sent_at: string
  opened_at: string | null
  replied: boolean
}

export interface Subscription {
  id: string
  user_id: string
  paddle_subscription_id: string | null
  paddle_customer_id: string | null
  plan: "free" | "pro"
  status: "active" | "trialing" | "past_due" | "cancelled"
  current_period_end: string | null
}

export interface IntegrationRow {
  id: string
  user_id: string
  provider: "stripe" | "paypal" | "xero" | "csv"
  status: "connected" | "error"
  display_name: string | null
  last_synced_at: string | null
  connected_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: string
}

export interface AgingTotals {
  collected_month_cents: number
  due_soon_cents: number
  overdue_cents: number
  outstanding_total_cents: number
  overdue_count: number
}

export const TONE_META: Record<Tone, { label: string; color: string; bg: string; border: string }> = {
  gentle: { label: "Gentle", color: "#8A6D1F", bg: "temp-gentle", border: "#C29A43" },
  nudge: { label: "Nudge", color: "#A85A12", bg: "temp-nudge", border: "#D9792B" },
  firm: { label: "Firm", color: "#A23A16", bg: "temp-firm", border: "#C14E2B" },
  final: { label: "Final", color: "#7E2119", bg: "temp-final", border: "#9E2A23" },
}

export interface ProviderConfig {
  stripe: { clientId: string; clientSecret: string; webhookSecret: string }
  paypal: { clientId: string; clientSecret: string; mode: string }
  xero: { clientId: string; clientSecret: string }
}