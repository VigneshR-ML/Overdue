import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Overdue — Get paid without the awkward conversation"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"
const SERIF = "Georgia, 'Times New Roman', serif"

const RUNGS = [
  { label: "gentle", day: "day 1", color: "#C29A43" },
  { label: "nudge", day: "day 7", color: "#D9792B" },
  { label: "firm", day: "day 14", color: "#C14E2B" },
  { label: "final", day: "day 21", color: "#9E2A23" },
]

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F6F4EE",
          padding: "72px 80px",
          fontFamily: SERIF,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 999,
                background: "#2F5D50",
                color: "#ffffff",
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              O
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 20,
                letterSpacing: 6,
                color: "#6E685D",
                textTransform: "uppercase",
              }}
            >
              Overdue · The Ledger
            </span>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: MONO,
              fontSize: 16,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#A7A091",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#3C7A68" }} />
            Autopilot for invoice follow-ups
          </div>

          <h1
            style={{
              margin: "28px 0 0 0",
              fontSize: 82,
              lineHeight: 1.02,
              letterSpacing: -1.5,
              color: "#1D1B17",
              fontWeight: 400,
            }}
          >
            Get paid without
            <br />
            the <span style={{ color: "#2F5D50", fontStyle: "italic" }}>awkward</span> conversation.
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            paddingTop: 28,
            borderTop: `2px solid #1D1B17`,
          }}
        >
          {RUNGS.map((r, i) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {i > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 18, color: "#A7A091" }}>→</span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: r.color }} />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 17,
                    color: "#1D1B17",
                  }}
                >
                  {r.label}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 15, color: "#6E685D" }}>
                  {r.day}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}