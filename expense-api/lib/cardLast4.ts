const LAST4_RE = /^\d{4}$/;

/** Validates and normalizes a card_last4 payload. Returns null if invalid. */
export function normalizeCardLast4(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const cleaned = input.map((v) => String(v).trim());
  if (cleaned.some((v) => !LAST4_RE.test(v))) return null;
  return cleaned;
}
