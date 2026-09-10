/**
 * Free-plan quotas. Kept in a dependency-free module because client components
 * import this (via draft.ts) — it must never pull in next/headers.
 */
export const FREE_CLIENT_LIMIT = 3
export const FREE_SEQUENCE_LIMIT = 1
export const FREE_INVOICE_LIMIT = 10
export const FREE_AI_DRAFTS_PER_MONTH = 5
