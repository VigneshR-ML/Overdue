export type NotificationType = "settlement_accepted" | "payment_promise" | "payment_plan" | "dispute" | "invoice_paid" | "reply_received" | "payment_link_needed" | "reminder_sent"

export type NotificationCategory = "Needs your attention" | "Client commitments" | "Payment activity" | "Reminder activity"

export function notificationCategory(type: string): NotificationCategory {
  if (["payment_plan", "dispute", "payment_link_needed", "reply_received"].includes(type)) return "Needs your attention"
  if (type === "payment_promise") return "Client commitments"
  if (type === "reminder_sent") return "Reminder activity"
  return "Payment activity"
}

export function notificationAction(type: string) {
  if (["payment_plan", "dispute", "payment_link_needed", "reply_received"].includes(type)) return "Review invoice"
  if (type === "payment_promise") return "View commitment"
  if (type === "reminder_sent") return "View reminder"
  return "View payment"
}
