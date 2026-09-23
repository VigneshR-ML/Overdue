import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv"

const MESSY = `"Bill To (Company)","Contact E-mail","Inv No.","Balance Owed ($)","Curr","Raised On","Pay By","State","Pay Link","Notes (ignore me)"
"Acme Corp",vigneshraiml@gmail.com,INV-1001,"$2,450.50",USD,2026-07-01,15/08/2026,overdue,,first reminder sent
"Cineverse Media",cineversemedias@gmail.com,INV-1002,₹18500,INR,01/07/2026,"Aug 20, 2026",sent,https://pay.example.com/inv-1002,
"Senthil Kumar",senthilkumaran539@gmail.com,INV-1003,750.00,USD,2026-08-10,2026-09-10,open,,
"Acme Corp",vigneshraiml@gmail.com,INV-1004,320.75,USD,2026-06-15,30/06/2026,paid,,
"Cineverse Media",cineversemedias@gmail.com,INV-1005,"$1,199.00",USD,2026-08-01,2026-09-01,sent,,GST invoice`

describe("parseCsv messy headers", () => {
  it("maps alias headers to invoices without skipping rows", () => {
    const { invoices, errors } = parseCsv(MESSY)
    expect(errors).toEqual([])
    expect(invoices).toHaveLength(5)
    expect(invoices[0]).toMatchObject({
      client_name: "Acme Corp",
      client_email: "vigneshraiml@gmail.com",
      number: "INV-1001",
      amount_cents: 245050,
      currency: "USD",
      status: "overdue",
    })
    expect(invoices[1]).toMatchObject({
      client_email: "cineversemedias@gmail.com",
      amount_cents: 1850000,
      currency: "INR",
      payment_url: "https://pay.example.com/inv-1002",
    })
    expect(invoices[2]).toMatchObject({ client_email: "senthilkumaran539@gmail.com" })
    expect(invoices[3]?.status).toBe("paid")
  })

  it("still parses canonical snake_case headers", () => {
    const { invoices, errors } = parseCsv(
      "client_name,client_email,number,amount,currency,issue_date,due_date,status,payment_url\nAcme,a@b.co,INV-1,10,USD,2026-01-01,2026-02-01,sent,",
    )
    expect(errors).toEqual([])
    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({ client_name: "Acme", number: "INV-1", amount_cents: 1000 })
  })

  it("understands representative PayPal, Stripe, QuickBooks and Xero export headers", () => {
    const examples = [
      `Invoice Number,Recipient Email,Recipient Name,Invoice Total,Currency,Invoice Date,Due Date,Status
INV-PP-1,alex@example.com,Alex Co,$125.50,USD,2026-09-01,2026-09-15,SENT`,
      `id,customer_email,customer_name,amount_due,currency,created,due_date,status,hosted_invoice_url
in_stripe_1,blair@example.com,Blair Studio,250.00,usd,2026-09-02,2026-09-16,open,https://pay.example/stripe`,
      `Num,Customer,Email,Open Balance,Currency,Date,Due Date,Status
QB-1001,Cedar LLC,cedar@example.com,375.25,USD,2026-09-03,2026-09-17,Open`,
      `InvoiceNumber,ContactName,EmailAddress,AmountDue,CurrencyCode,Date,DueDate,Status
XERO-1001,Delta Agency,delta@example.com,480.00,USD,2026-09-04,2026-09-18,AUTHORISED`,
    ]

    for (const csv of examples) {
      const { invoices, errors } = parseCsv(csv)
      expect(errors).toEqual([])
      expect(invoices).toHaveLength(1)
      expect(invoices[0]?.amount_cents).toBeGreaterThan(0)
      expect(invoices[0]?.number).toBeTruthy()
    }
  })
})
