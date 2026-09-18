import { describe, expect, it } from "vitest"
import { extractMessageIdTokens } from "./thread-ids"
import { extractThreadHeaders } from "./inbound"

describe("extractMessageIdTokens", () => {
  it("extracts raw and base tokens from angle-bracketed ids", () => {
    const tokens = extractMessageIdTokens("<abc123@mx.example.com>", "def456@other.com")
    expect(tokens).toContain("abc123@mx.example.com")
    expect(tokens).toContain("abc123")
    expect(tokens).toContain("def456@other.com")
    expect(tokens).toContain("def456")
  })

  it("ignores malformed headers and empty strings", () => {
    expect(extractMessageIdTokens(null, undefined, "", "   ")).toEqual([])
  })
})

describe("extractThreadHeaders", () => {
  it("handles array-of-{name,value} headers (email webhook shape)", () => {
    const headers = [
      { name: "Message-ID", value: "<out1@mail.local>" },
      { name: "References", value: "<in1@mail.local>" },
    ]
    const out = extractThreadHeaders(headers)
    expect(out).toMatchObject({ references: expect.stringContaining("in1") })
  })

  it("handles a plain object of headers", () => {
    const out = extractThreadHeaders({ "In-Reply-To": "<a@b.c>", references: "<x@y.z>" })
    expect(out).toMatchObject({ inReplyTo: expect.stringContaining("a@b.c") })
  })
})