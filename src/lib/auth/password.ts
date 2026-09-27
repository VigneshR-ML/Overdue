export const PASSWORD_REQUIREMENTS =
  "At least 10 characters, one uppercase letter, and one number."

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters."
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter."
  if (!/\d/.test(password)) return "Password must include a number."
  return null
}
