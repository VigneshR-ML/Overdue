import { describe, expect, it } from "vitest"
import { formatFromAddress, renderEscalationEmail } from "./send"

const BASE = {
  subject: "Overdue invoice",
  body: "Please pay soon.",
  senderName: "V",
  companyName: "Acme",
}

describe("renderEscalationEmail resolution button", () => {
  it("adds a Resolve button when a valid resolution URL is present", () => {
    const html = renderEscalationEmail({
      ...BASE,
      resolutionUrl: "https://getoverdue.online/r/abc.123.sig",
      resolutionLabel: "Resolve for 499 INR",
    })
    expect(html).toContain("https://getoverdue.online/r/abc.123.sig")
    expect(html).toContain("Resolve for 499 INR")
  })

  it("omits the button without a URL or with a non-http URL", () => {
    expect(renderEscalationEmail({ ...BASE })).not.toContain("Resolve")
    expect(
      renderEscalationEmail({ ...BASE, resolutionUrl: "javascript:alert(1)" }),
    ).not.toContain("javascript:")
  })
})

describe("formatFromAddress", () => {
  it("uses the workspace sender name with the verified delivery address", () => {
    expect(formatFromAddress("Overdue <reminders@getoverdue.online>", "Vignesh Studio"))
      .toBe("Vignesh Studio via Overdue <reminders@getoverdue.online>")
  })

  it("strips header-breaking characters from sender names", () => {
    expect(formatFromAddress("reminders@getoverdue.online", "Vignesh\r\nBcc: bad@example.com"))
      .toBe("Vignesh Bcc bad example.com via Overdue <reminders@getoverdue.online>")
  })
})
