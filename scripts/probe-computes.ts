import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"

function seed(spec: { example?: Record<string, string>; fields: { key: string; defaultValue: string }[] }) {
  if (spec.example) return { ...spec.example }
  return Object.fromEntries(spec.fields.map((f) => [f.key, f.defaultValue]))
}

const results: string[] = []
for (const t of TOOL_CALCULATORS) {
  const v = seed(t.spec)
  const start = Date.now()
  let ok = true
  try {
    t.spec.compute(v)
  } catch {
    ok = false
  }
  results.push(`${t.slug.padEnd(26)} ${(Date.now() - start) + "ms"} ${ok ? "ok" : "threw"}`)
}
console.log(results.join("\n"))
