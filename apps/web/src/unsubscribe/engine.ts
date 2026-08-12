import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { blocklist, type SenderRow, senders, unsubscribeAttempts } from "@/db/schema"

/**
 * Every attempt this module makes writes a row here first — the audit trail
 * the brief requires is a side effect of how these functions are written,
 * not a separate step a caller can forget.
 */

export const BLOCK_REASON =
  "Contacting a spammer's unsubscribe link confirms the address is live and increases volume — this sender was blocked locally instead."

export type UnsubscribeDecision =
  | { method: "one_click_post"; url: string }
  | { method: "manual_link"; url: string }
  | { method: "mailto"; address: string }
  | { method: null; reason: string }

/**
 * The safety gate: only a `legitimate` sender ever gets an unsubscribe
 * method at all. Suspicious and unknown senders are handled entirely by
 * `blockSender` — contacting their unsubscribe link (if they even have a
 * real one) confirms the address is live.
 */
export function decideUnsubscribeMethod(sender: SenderRow): UnsubscribeDecision {
  if (sender.classification !== "legitimate") {
    return { method: null, reason: "sender is not classified legitimate" }
  }
  if (sender.oneClickSupported && sender.unsubscribeUrl) {
    return { method: "one_click_post", url: sender.unsubscribeUrl }
  }
  if (sender.unsubscribeUrl) {
    return { method: "manual_link", url: sender.unsubscribeUrl }
  }
  if (sender.unsubscribeMailto) {
    return { method: "mailto", address: sender.unsubscribeMailto }
  }
  return { method: null, reason: "no unsubscribe method was found on any scanned message" }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** RFC 8058 one-click POST, with the response recorded whether it succeeds or not. */
async function performOneClickUnsubscribe(sender: SenderRow, url: string): Promise<void> {
  let httpStatus: number | null = null
  let detail: string | null = null

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      signal: AbortSignal.timeout(10_000),
    })
    httpStatus = response.status
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error)
  }

  await db().insert(unsubscribeAttempts).values({
    senderId: sender.id,
    method: "one_click_post",
    httpStatus,
    detail,
  })

  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
    await db()
      .update(senders)
      .set({ status: "unsubscribed", updatedAt: new Date() })
      .where(eq(senders.id, sender.id))
  }
}

/** A single sender's Unsubscribe button — only ever reachable for method = one_click_post. */
export async function unsubscribeFromSender(senderId: string): Promise<void> {
  const [sender] = await db().select().from(senders).where(eq(senders.id, senderId)).limit(1)
  if (!sender) throw new Error("sender not found")

  const decision = decideUnsubscribeMethod(sender)
  if (decision.method !== "one_click_post") {
    throw new Error("this sender has no one-click unsubscribe method")
  }

  await performOneClickUnsubscribe(sender, decision.url)
}

export const MAX_UNSUBSCRIBES_PER_RUN = 50
export const UNSUBSCRIBE_INTERVAL_MS = 1000

/**
 * "Unsubscribe from all eligible senders": every `legitimate`, still-`active`
 * sender with a one-click method, capped at 50 and spaced 1 second apart —
 * both limits from the brief, both non-negotiable.
 */
export async function runBulkUnsubscribe(): Promise<{ attempted: number }> {
  const eligible = await db()
    .select()
    .from(senders)
    .where(and(eq(senders.classification, "legitimate"), eq(senders.status, "active")))

  const targets = eligible
    .filter((sender) => decideUnsubscribeMethod(sender).method === "one_click_post")
    .slice(0, MAX_UNSUBSCRIBES_PER_RUN)

  for (let index = 0; index < targets.length; index++) {
    if (index > 0) await sleep(UNSUBSCRIBE_INTERVAL_MS)
    const sender = targets[index]
    if (!sender) continue
    const decision = decideUnsubscribeMethod(sender)
    if (decision.method !== "one_click_post") continue
    await performOneClickUnsubscribe(sender, decision.url)
  }

  return { attempted: targets.length }
}

/**
 * The alternative to unsubscribing: for suspicious and unknown senders,
 * blocking is the only action offered, because their unsubscribe link (if
 * present at all) is not one this app will ever contact.
 */
export async function blockSender(senderId: string, reason: string): Promise<void> {
  await db()
    .insert(blocklist)
    .values({ senderId, reason })
    .onConflictDoUpdate({ target: blocklist.senderId, set: { reason } })

  await db()
    .update(senders)
    .set({ status: "blocked", updatedAt: new Date() })
    .where(eq(senders.id, senderId))

  await db().insert(unsubscribeAttempts).values({
    senderId,
    method: "blocked",
    detail: reason,
  })
}
