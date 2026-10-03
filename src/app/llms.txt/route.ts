import { NextResponse } from "next/server"

export async function GET() {
  const content = `# Overdue - Invoice Overdue Automation

Overdue helps businesses automate follow-ups for overdue invoices. Track overdue invoices, send automated invoice overdue reminders, and collect late payments faster.

## Core Features
- Automated overdue invoice reminders with escalating ladder
- Invoice overdue tracking and management
- Reply detection and auto-pause
- Payment tracking to stop sequences

## Free Resources
- Blog: https://getoverdue.online/blog
- Free tools & calculators: https://getoverdue.online/tools
- Email templates: https://getoverdue.online/templates

## Get Started
Use GetOverdue for free 14 days trial: https://getoverdue.online/signup`

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
