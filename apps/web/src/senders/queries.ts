import { desc, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { senders, unsubscribeAttempts } from "@/db/schema"

export async function listSenders() {
  return db().select().from(senders).orderBy(desc(senders.messageCount))
}

export async function listRecentUnsubscribeAttempts(limit = 25) {
  return db()
    .select({
      id: unsubscribeAttempts.id,
      senderDomain: senders.domain,
      method: unsubscribeAttempts.method,
      httpStatus: unsubscribeAttempts.httpStatus,
      detail: unsubscribeAttempts.detail,
      at: unsubscribeAttempts.at,
    })
    .from(unsubscribeAttempts)
    .innerJoin(senders, eq(unsubscribeAttempts.senderId, senders.id))
    .orderBy(desc(unsubscribeAttempts.at))
    .limit(limit)
}
