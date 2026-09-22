import crypto from "crypto"

const PREVIEW_TTL_MS = 10 * 60 * 1000
const MAX_SUBJECT_LENGTH = 240
const MAX_BODY_LENGTH = 8_000

export type EmailPreviewDraft = {
  version: 1
  userId: string
  invoiceId: string
  runId: string
  step: number
  subject: string
  body: string
  offerId: string | null
  expiresAt: number
}

function getSecret(override?: string): string {
  const secret = override
    ?? process.env.EMAIL_PREVIEW_SECRET
    ?? process.env.SETTLEMENT_SECRET
    ?? process.env.CRON_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("EMAIL_PREVIEW_SECRET (or another server secret) is required for email confirmation")
  return secret
}

function validDraft(value: unknown): value is EmailPreviewDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Partial<EmailPreviewDraft>
  return draft.version === 1
    && typeof draft.userId === "string" && draft.userId.length > 0
    && typeof draft.invoiceId === "string" && draft.invoiceId.length > 0
    && typeof draft.runId === "string" && draft.runId.length > 0
    && Number.isInteger(draft.step) && Number(draft.step) >= 0
    && typeof draft.subject === "string" && draft.subject.length > 0 && draft.subject.length <= MAX_SUBJECT_LENGTH
    && typeof draft.body === "string" && draft.body.length > 0 && draft.body.length <= MAX_BODY_LENGTH
    && (draft.offerId === null || typeof draft.offerId === "string")
    && Number.isFinite(draft.expiresAt)
}

/** Signs the exact server-generated subject/body the owner reviewed. */
export function signEmailPreview(
  draft: Omit<EmailPreviewDraft, "version" | "expiresAt">,
  secret?: string,
): string {
  const payload: EmailPreviewDraft = {
    ...draft,
    version: 1,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  }
  if (!validDraft(payload)) throw new Error("invalid email preview")
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", getSecret(secret)).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyEmailPreview(token: string, secret?: string): EmailPreviewDraft | null {
  const [encoded, signature, extra] = token.split(".")
  if (!encoded || !signature || extra) return null
  const expected = crypto.createHmac("sha256", getSecret(secret)).update(encoded).digest("base64url")
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return null

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown
    if (!validDraft(parsed) || parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

