/**
 * Pure parsing of the five metadata headers the scan fetches (From,
 * List-Unsubscribe, List-Unsubscribe-Post, Date — plus Authentication-Results,
 * which the classification rule in AGENTS.md's brief needs even though the
 * brief's own header list for the fetch omits it; see docs/ARCHITECTURE.md).
 *
 * No network, no database — kept separate from gmail/scan.ts so the parsing
 * rules are unit-testable without a Gmail account.
 */

export type ParsedAddress = { address: string; domain: string }

/** Extracts the address and lower-cased domain from a From header. */
export function parseFromAddress(header: string): ParsedAddress | null {
  const angleMatch = header.match(/<([^>]+)>/)
  const candidate = (angleMatch?.[1] ?? header).trim()
  const at = candidate.lastIndexOf("@")
  if (at <= 0 || at === candidate.length - 1) return null

  const address = candidate.toLowerCase()
  const domain = address.slice(at + 1).trim()
  if (!domain || /\s/.test(domain)) return null

  return { address, domain }
}

export type ParsedUnsubscribe = { url: string | null; mailto: string | null }

/** Extracts the https link and/or mailto address from a List-Unsubscribe header. */
export function parseListUnsubscribe(header: string): ParsedUnsubscribe {
  const targets = [...header.matchAll(/<([^>]+)>/g)].map((match) => match[1]?.trim() ?? "")

  const url = targets.find((target) => /^https?:\/\//i.test(target)) ?? null
  const mailto = targets.find((target) => /^mailto:/i.test(target)) ?? null

  return { url, mailto: mailto ? mailto.replace(/^mailto:/i, "") : null }
}

/** RFC 8058: List-Unsubscribe-Post: List-Unsubscribe=One-Click. */
export function supportsOneClick(header: string | undefined): boolean {
  return /List-Unsubscribe\s*=\s*One-Click/i.test(header ?? "")
}

/**
 * Whether this message passed DMARC or SPF alignment, per the
 * Authentication-Results header. Either mechanism passing is enough to call
 * the message aligned — DMARC and SPF are alternative paths to the same
 * guarantee, and requiring both would reject senders that legitimately rely
 * on only one.
 */
export function isAuthAligned(header: string | undefined): boolean {
  if (!header) return false
  return /\bdmarc=pass\b/i.test(header) || /\bspf=pass\b/i.test(header)
}
