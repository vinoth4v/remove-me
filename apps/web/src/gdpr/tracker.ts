import { and, desc, eq, lt } from "drizzle-orm"
import { db } from "@/db/client"
import { type GdprArticle, gdprRequests, type GdprLanguage, senders } from "@/db/schema"
import { getGmailAccount } from "@/gmail/oauth.ts"
import { generateGdprEmail } from "./templates.ts"

const RESPONSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function listGdprRequests() {
  return db()
    .select({
      id: gdprRequests.id,
      senderId: gdprRequests.senderId,
      senderDomain: senders.domain,
      controllerName: gdprRequests.controllerName,
      article: gdprRequests.article,
      language: gdprRequests.language,
      body: gdprRequests.body,
      status: gdprRequests.status,
      sentAt: gdprRequests.sentAt,
      responseDueAt: gdprRequests.responseDueAt,
      createdAt: gdprRequests.createdAt,
    })
    .from(gdprRequests)
    .leftJoin(senders, eq(gdprRequests.senderId, senders.id))
    .orderBy(desc(gdprRequests.createdAt))
}

export async function createGdprRequest(input: {
  senderId: string | null
  controllerName: string
  article: GdprArticle
  language: GdprLanguage
}): Promise<void> {
  const account = await getGmailAccount()
  if (!account) {
    throw new Error("Connect Gmail first — the identifier in every request is that address")
  }

  const body = generateGdprEmail({
    article: input.article,
    language: input.language,
    controllerName: input.controllerName,
    myEmail: account.emailAddress,
  })

  await db().insert(gdprRequests).values({
    senderId: input.senderId,
    controllerName: input.controllerName,
    article: input.article,
    language: input.language,
    body,
  })
}

/** Marking a request sent starts its 30-day response countdown. */
export async function markGdprRequestSent(requestId: string): Promise<void> {
  const sentAt = new Date()
  await db()
    .update(gdprRequests)
    .set({ status: "sent", sentAt, responseDueAt: new Date(sentAt.getTime() + RESPONSE_WINDOW_MS) })
    .where(eq(gdprRequests.id, requestId))
}

export async function markGdprRequestResponded(requestId: string): Promise<void> {
  await db().update(gdprRequests).set({ status: "responded" }).where(eq(gdprRequests.id, requestId))
}

/**
 * Flips `sent` requests whose 30-day window has passed to `overdue`. The app
 * has no way to know a controller responded outside the countdown, so this
 * is the only automatic status transition — run from the daily cron.
 */
export async function sweepOverdueGdprRequests(): Promise<number> {
  const overdueCondition = and(eq(gdprRequests.status, "sent"), lt(gdprRequests.responseDueAt, new Date()))

  const overdue = await db().select({ id: gdprRequests.id }).from(gdprRequests).where(overdueCondition)
  if (overdue.length === 0) return 0

  await db().update(gdprRequests).set({ status: "overdue" }).where(overdueCondition)
  return overdue.length
}
