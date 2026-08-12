"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { bulkSender, gmailConnection } from "@/db/schema"
import {
  accessTokenFromRefresh,
  getMessageMeta,
  listMessageIds,
  type MessageMeta,
} from "@/inbox/gmail"
import { isSafeUnsubscribeUrl, parseFromHeader, parseListUnsubscribe } from "@/inbox/parse"
import { decryptIdentifier, encryptIdentifier } from "@/vault/crypto"

const SCAN_LIMIT = 100

type FoundSender = {
  name: string | null
  count: number
  url: string | null
  mailto: string | null
  oneClick: boolean
  lastSeen: Date | null
}

function groupBySender(metas: MessageMeta[]): Map<string, FoundSender> {
  const found = new Map<string, FoundSender>()
  for (const meta of metas) {
    if (!meta.from) continue
    const from = parseFromHeader(meta.from)
    const method = parseListUnsubscribe(meta.listUnsubscribe, meta.listUnsubscribePost)
    if (!from || !method) continue

    const existing = found.get(from.address)
    if (!existing) {
      found.set(from.address, {
        name: from.name,
        count: 1,
        url: method.url,
        mailto: method.mailto,
        oneClick: method.oneClick,
        lastSeen: meta.internalDate,
      })
      continue
    }
    existing.count += 1
    existing.name ??= from.name
    // The newest message wins for the unsubscribe target — links expire.
    if (meta.internalDate && (!existing.lastSeen || meta.internalDate > existing.lastSeen)) {
      existing.lastSeen = meta.internalDate
      existing.url = method.url ?? existing.url
      existing.mailto = method.mailto ?? existing.mailto
      existing.oneClick = method.oneClick
    }
  }
  return found
}

export async function scanInboxAction(): Promise<void> {
  const [connection] = await db().select().from(gmailConnection)
  if (!connection) redirect("/inbox?error=not_connected")

  let ids: string[]
  const metas: MessageMeta[] = []
  try {
    const token = await accessTokenFromRefresh(decryptIdentifier(connection.refreshTokenEncrypted))
    ids = await listMessageIds(token, SCAN_LIMIT)
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10)
      metas.push(...(await Promise.all(chunk.map((id) => getMessageMeta(token, id)))))
    }
  } catch {
    redirect("/inbox?error=scan_failed")
  }

  const found = groupBySender(metas)
  for (const [address, sender] of found) {
    await db()
      .insert(bulkSender)
      .values({
        address,
        name: sender.name,
        messageCount: sender.count,
        unsubscribeUrlEncrypted: sender.url ? encryptIdentifier(sender.url) : null,
        unsubscribeMailtoEncrypted: sender.mailto ? encryptIdentifier(sender.mailto) : null,
        oneClick: sender.oneClick,
        lastSeenAt: sender.lastSeen,
      })
      .onConflictDoUpdate({
        target: bulkSender.address,
        set: {
          name: sender.name,
          messageCount: sql`GREATEST(${bulkSender.messageCount}, ${sender.count})`,
          unsubscribeUrlEncrypted: sender.url ? encryptIdentifier(sender.url) : null,
          unsubscribeMailtoEncrypted: sender.mailto ? encryptIdentifier(sender.mailto) : null,
          oneClick: sender.oneClick,
          lastSeenAt: sender.lastSeen,
          // status deliberately untouched: an unsubscribed sender that shows
          // up again keeps its history — the lastSeen date tells the story.
        },
      })
  }

  await recordEvent("inbox_scanned", null, `${metas.length} messages, ${found.size} senders`)
  revalidatePath("/inbox")
  redirect(`/inbox?scanned=${metas.length}&senders=${found.size}`)
}

async function performOneClick(urlEncrypted: string | null): Promise<boolean> {
  if (!urlEncrypted) return false
  const url = decryptIdentifier(urlEncrypted)
  if (!isSafeUnsubscribeUrl(url)) return false
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      signal: AbortSignal.timeout(10_000),
    })
    return response.status < 400
  } catch {
    return false
  }
}

export async function unsubscribeOneClickAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  const [sender] = await db().select().from(bulkSender).where(eq(bulkSender.id, id))
  if (!sender?.oneClick) redirect("/inbox?error=not_one_click")

  const ok = await performOneClick(sender.unsubscribeUrlEncrypted)
  if (!ok) redirect("/inbox?error=unsubscribe_failed")

  await db()
    .update(bulkSender)
    .set({ status: "unsubscribed", actedAt: new Date() })
    .where(eq(bulkSender.id, id))
  await recordEvent("sender_unsubscribed", null, sender.address)
  revalidatePath("/inbox")
}

/** The bulk button: every remaining one-click sender in one go. */
export async function unsubscribeAllAction(): Promise<void> {
  const pending = await db()
    .select()
    .from(bulkSender)
    .where(and(eq(bulkSender.status, "new"), eq(bulkSender.oneClick, true)))

  let done = 0
  for (const sender of pending) {
    if (!(await performOneClick(sender.unsubscribeUrlEncrypted))) continue
    await db()
      .update(bulkSender)
      .set({ status: "unsubscribed", actedAt: new Date() })
      .where(eq(bulkSender.id, sender.id))
    await recordEvent("sender_unsubscribed", null, sender.address)
    done += 1
  }

  revalidatePath("/inbox")
  redirect(`/inbox?bulk_done=${done}&bulk_total=${pending.length}`)
}

const idSchema = z.object({ id: z.uuid() })

/** For mailto/link senders: the operator did the step themselves. */
export async function markUnsubscribedAction(formData: FormData): Promise<void> {
  const { id } = idSchema.parse({ id: formData.get("id") })
  await db()
    .update(bulkSender)
    .set({ status: "unsubscribed", actedAt: new Date() })
    .where(eq(bulkSender.id, id))
  revalidatePath("/inbox")
}

export async function keepSenderAction(formData: FormData): Promise<void> {
  const { id } = idSchema.parse({ id: formData.get("id") })
  await db()
    .update(bulkSender)
    .set({ status: "kept", actedAt: new Date() })
    .where(eq(bulkSender.id, id))
  revalidatePath("/inbox")
}

export async function disconnectGmailAction(): Promise<void> {
  await db().delete(gmailConnection)
  revalidatePath("/inbox")
}
