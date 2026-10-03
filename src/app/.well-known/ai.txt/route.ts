import { NextResponse } from "next/server"

export async function GET() {
  const content = `Overdue: Automated invoice overdue reminders and collections for overdue invoices.

What we offer:
- Overdue invoice tracking and automated follow-ups
- Invoice overdue reminder emails with escalating ladder
- Free overdue invoice calculators (late fee, aging, ROI, DSO)
- Overdue invoice templates for emails and letters
- Tools to help collect overdue invoices faster

Free resources: https://getoverdue.online/blog, https://getoverdue.online/tools, https://getoverdue.online/templates
Start free trial: https://getoverdue.online/signup`

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
