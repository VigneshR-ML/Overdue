import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getOwnedRecord } from "./ownership"

/** Records the builder chain and resolves with a canned result. */
function fakeSupabase(result: { data: unknown; error: { message: string; code: string } | null }) {
  const calls: string[] = []
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  builder.select = vi.fn((columns: string) => {
    calls.push(`select:${columns}`)
    return builder
  })
  builder.eq = vi.fn((key: string, value: string) => {
    calls.push(`eq:${key}=${value}`)
    return builder
  })
  builder.maybeSingle = vi.fn(async () => {
    calls.push("maybeSingle")
    return result
  })
  const client = {
    from: vi.fn((table: string) => {
      calls.push(`from:${table}`)
      return builder
    }),
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe("getOwnedRecord", () => {
  it("returns the record when the row is owned by the user", async () => {
    const { client, calls } = fakeSupabase({
      data: { id: "inv_1", amount_cents: 1000 },
      error: null,
    })
    const out = await getOwnedRecord<{ id: string; amount_cents: number }>(
      client,
      "invoices",
      "inv_1",
      "user_9",
      "id, amount_cents",
    )
    expect(out).toEqual({ ok: true, record: { id: "inv_1", amount_cents: 1000 } })
    expect(calls).toEqual([
      "from:invoices",
      "select:id, amount_cents",
      "eq:id=inv_1",
      "eq:user_id=user_9",
      "maybeSingle",
    ])
  })

  it("returns not_found when no owned row exists", async () => {
    const { client } = fakeSupabase({ data: null, error: null })
    const out = await getOwnedRecord(client, "invoices", "inv_404", "user_9")
    expect(out).toEqual({ ok: false, reason: "not_found" })
  })

  it("returns db_error with a message when the query fails", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "permission denied for table invoices", code: "42501" },
    })
    const out = await getOwnedRecord(client, "invoices", "inv_1", "user_9")
    expect(out).toEqual({ ok: false, reason: "db_error", message: "permission denied for table invoices" })
  })

  it("short-circuits to not_found on empty id or userId", async () => {
    const { client, calls } = fakeSupabase({ data: null, error: null })
    expect(await getOwnedRecord(client, "invoices", "", "user_9")).toEqual({ ok: false, reason: "not_found" })
    expect(await getOwnedRecord(client, "invoices", "inv_1", " ")).toEqual({ ok: false, reason: "not_found" })
    expect(calls).toEqual([])
  })

  it("defaults the select to all columns", async () => {
    const { client, calls } = fakeSupabase({ data: { id: "inv_1" }, error: null })
    await getOwnedRecord(client, "clients", "c_1", "user_9")
    expect(calls[1]).toBe("select:*")
  })
})