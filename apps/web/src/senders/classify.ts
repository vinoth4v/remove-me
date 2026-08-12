import type { SenderClassification } from "@/db/schema"

export type ClassifyInput = {
  hasListUnsubscribe: boolean
  authAligned: boolean
  messageCount: number
  firstSeen: Date
  lastSeen: Date
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The classification rule from the brief, implemented exactly:
 *
 *   legitimate = List-Unsubscribe present AND DMARC/SPF aligned AND
 *                seen 3+ times over a 30+ day span
 *   suspicious = no List-Unsubscribe, OR auth failure, OR a first-and-only
 *                message from this domain
 *   unknown    = anything else
 *
 * This gates the Unsubscribe engine, so it is deliberately the only place
 * this decision is made — every caller (the scan, the classification
 * refresh, the UI badge) goes through this function rather than
 * re-deriving it.
 */
export function classifySender(input: ClassifyInput): SenderClassification {
  const isFirstAndOnly = input.messageCount === 1

  if (!input.hasListUnsubscribe || !input.authAligned || isFirstAndOnly) {
    return "suspicious"
  }

  const spanMs = input.lastSeen.getTime() - input.firstSeen.getTime()
  if (input.messageCount >= 3 && spanMs >= THIRTY_DAYS_MS) {
    return "legitimate"
  }

  return "unknown"
}
