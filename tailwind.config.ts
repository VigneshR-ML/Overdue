import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F4EE",
        surface: "#FFFFFF",
        ink: "#1D1B17",
        "ink-soft": "#47423A",
        muted: "#6E685D",
        faint: "#A7A091",
        hairline: "#E7E3D8",
        moss: {
          DEFAULT: "#2F5D50",
          bright: "#3C7A68",
          soft: "#E4EEE8",
          deep: "#22463C",
        },
        brass: "#C29A43",
        ember: "#D9792B",
        rust: "#C14E2B",
        crimson: "#9E2A23",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-figtree)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 2px rgba(29, 27, 23, 0.06)",
      },
      letterSpacing: {
        tabular: "0.01em",
      },
      maxWidth: {
        measure: "65ch",
      },
    },
  },
  plugins: [],
}

export default config