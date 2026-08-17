// Mirrors backend/routes/auth.js's PASSWORD_REGEX / MOBILE_REGEX so
// client-side validation never drifts from what the server enforces.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
// Strict E.164 — the leading + and country code are required, because
// Twilio rejects bare national numbers ("Invalid 'To' Phone Number").
export const MOBILE_REGEX = /^\+[1-9]\d{7,14}$/

/** Per-rule pass/fail breakdown, for a live checklist under the password field. */
export function passwordChecklist(password) {
  return [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One number', valid: /\d/.test(password) },
    { label: 'One special character', valid: /[^A-Za-z0-9]/.test(password) },
  ]
}
