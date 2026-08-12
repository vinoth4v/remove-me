import { db } from "@/db/client"
import { breachCache, gmailAccount, senders } from "@/db/schema"
import { decideUnsubscribeMethod } from "@/unsubscribe/engine.ts"

export type ExposureSummary = {
  totalSenders: number
  unsubscribableCount: number
  breachCount: number
  score: number
  lastCalculated: Date | null
}

/**
 * A transparent, live-computed score rather than a stored one: nothing in
 * the brief asks for a persisted history of past scores, and computing it
 * from the current senders/breach data on every read means it can never go
 * stale relative to what the Senders and Breaches screens show. "Last
 * calculated" is the more recent of the two things it is calculated from.
 */
export async function getExposureSummary(): Promise<ExposureSummary> {
  const allSenders = await db().select().from(senders)
  const totalSenders = allSenders.length

  const unsubscribableCount = allSenders.filter(
    (sender) => sender.status === "active" && decideUnsubscribeMethod(sender).method === "one_click_post",
  ).length

  const suspiciousActive = allSenders.filter(
    (sender) => sender.status === "active" && sender.classification === "suspicious",
  ).length
  const unresolvedLegitimate = allSenders.filter(
    (sender) => sender.status === "active" && sender.classification === "legitimate",
  ).length

  const [account] = await db().select().from(gmailAccount).limit(1)
  const [cache] = await db().select().from(breachCache).limit(1)
  const breachCount = cache?.payload.length ?? 0

  const rawScore = suspiciousActive * 3 + breachCount * 10 + unresolvedLegitimate * 1
  const score = Math.min(100, Math.round(rawScore))

  const candidates = [account?.scanCompletedAt, cache?.fetchedAt].filter(
    (date): date is Date => date instanceof Date,
  )
  const lastCalculated =
    candidates.length > 0
      ? new Date(Math.max(...candidates.map((date) => date.getTime())))
      : null

  return { totalSenders, unsubscribableCount, breachCount, score, lastCalculated }
}
