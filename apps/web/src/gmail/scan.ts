import { eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { gmailAccount, type NewSenderRow, senders } from "@/db/schema"
import { classifySender } from "@/senders/classify.ts"
import { getGmailAccount, getValidAccessToken } from "./oauth.ts"
import { getMessageMetadata, listMessageIds } from "./client.ts"
import {
  isAuthAligned,
  parseFromAddress,
  parseListUnsubscribe,
  supportsOneClick,
} from "./headers.ts"

/** Hard cap from the brief: the initial scan never looks past the last 5,000 messages. */
export const SCAN_MESSAGE_CAP = 5000
const PAGE_SIZE = 100
const FETCH_CONCURRENCY = 8
// Vercel Hobby allows up to 60s per invocation; this leaves margin to persist
// progress before the platform would kill the function outright.
const TIME_BUDGET_MS = 45_000

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) continue
      results[index] = await fn(item)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

type SenderState = {
  domain: string
  sampleAddress: string
  messageCount: number
  firstSeen: Date
  lastSeen: Date
  hasListUnsubscribe: boolean
  oneClickSupported: boolean
  unsubscribeUrl: string | null
  unsubscribeMailto: string | null
  authAligned: boolean
}

export type ScanResult = {
  fetched: number
  totalFetched: number
  sendersTouched: number
  done: boolean
}

/**
 * Processes up to one page's worth of Gmail metadata per loop iteration,
 * persisting progress after every page so a timeout mid-scan loses at most
 * one page of work — the cursor picks up exactly where it left off on the
 * next call, whether that is a manual retrigger or the next day's cron run.
 */
export async function runScan(): Promise<ScanResult> {
  const account = await getGmailAccount()
  if (!account) throw new Error("Gmail is not connected yet")

  const startedAt = Date.now()

  if (!account.scanStartedAt) {
    await db()
      .update(gmailAccount)
      .set({ scanStartedAt: new Date() })
      .where(eq(gmailAccount.id, account.id))
  }

  // Existing rows, loaded once so header-derived fields can be compared
  // against what a domain already carries without a read per message.
  const existing = await db().select().from(senders)
  const state = new Map<string, SenderState>(
    existing.map((row) => [
      row.domain,
      {
        domain: row.domain,
        sampleAddress: row.sampleAddress,
        messageCount: row.messageCount,
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen,
        hasListUnsubscribe: row.hasListUnsubscribe,
        oneClickSupported: row.oneClickSupported,
        unsubscribeUrl: row.unsubscribeUrl,
        unsubscribeMailto: row.unsubscribeMailto,
        authAligned: row.authAligned,
      },
    ]),
  )

  let cursor = account.scanCursor
  let totalFetched = account.scanTotalFetched
  let fetchedThisRun = 0
  let done = false

  while (true) {
    if (totalFetched >= SCAN_MESSAGE_CAP) {
      done = true
      break
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) break

    const accessToken = await getValidAccessToken()
    const page = await listMessageIds(accessToken, {
      pageToken: cursor ?? undefined,
      maxResults: Math.min(PAGE_SIZE, SCAN_MESSAGE_CAP - totalFetched),
    })

    if (page.ids.length === 0) {
      done = true
      break
    }

    const metadata = await mapWithConcurrency(page.ids, FETCH_CONCURRENCY, (id) =>
      getMessageMetadata(accessToken, id),
    )

    const touchedDomains = new Set<string>()

    for (const message of metadata) {
      if (!message.from) continue
      const parsed = parseFromAddress(message.from)
      if (!parsed) continue

      touchedDomains.add(parsed.domain)

      const unsubscribe = parseListUnsubscribe(message.listUnsubscribe ?? "")
      const hasListUnsubscribe = Boolean(message.listUnsubscribe)
      const oneClick = supportsOneClick(message.listUnsubscribePost ?? undefined)
      const aligned = isAuthAligned(message.authenticationResults ?? undefined)

      const current = state.get(parsed.domain)
      if (!current) {
        state.set(parsed.domain, {
          domain: parsed.domain,
          sampleAddress: parsed.address,
          messageCount: 1,
          firstSeen: message.date,
          lastSeen: message.date,
          hasListUnsubscribe,
          oneClickSupported: oneClick,
          unsubscribeUrl: unsubscribe.url,
          unsubscribeMailto: unsubscribe.mailto,
          authAligned: aligned,
        })
        continue
      }

      current.messageCount += 1
      if (message.date < current.firstSeen) current.firstSeen = message.date
      // Gmail lists newest-first, so the first time a domain is seen within a
      // scan is its most recent message; anything after that is older and
      // must not overwrite the header-derived fields.
      if (message.date > current.lastSeen) {
        current.lastSeen = message.date
        current.sampleAddress = parsed.address
        current.hasListUnsubscribe = hasListUnsubscribe
        current.oneClickSupported = oneClick
        current.unsubscribeUrl = unsubscribe.url
        current.unsubscribeMailto = unsubscribe.mailto
        current.authAligned = aligned
      }
    }

    totalFetched += page.ids.length
    fetchedThisRun += page.ids.length
    cursor = page.nextPageToken

    await persistTouchedSenders(state, touchedDomains)

    await db()
      .update(gmailAccount)
      .set({
        scanCursor: cursor,
        scanTotalFetched: totalFetched,
        ...(cursor ? {} : { scanCompletedAt: new Date() }),
      })
      .where(eq(gmailAccount.id, account.id))

    if (!cursor) {
      done = true
      break
    }
  }

  if (done) {
    await db()
      .update(gmailAccount)
      .set({ scanCompletedAt: new Date(), lastScanError: null })
      .where(eq(gmailAccount.id, account.id))
  }

  return { fetched: fetchedThisRun, totalFetched, sendersTouched: state.size, done }
}

async function persistTouchedSenders(
  state: Map<string, SenderState>,
  touchedDomains: Set<string>,
): Promise<void> {
  for (const domain of touchedDomains) {
    const entry = state.get(domain)
    if (!entry) continue

    const classification = classifySender({
      hasListUnsubscribe: entry.hasListUnsubscribe,
      authAligned: entry.authAligned,
      messageCount: entry.messageCount,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
    })

    const values: NewSenderRow = {
      domain: entry.domain,
      sampleAddress: entry.sampleAddress,
      messageCount: entry.messageCount,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      hasListUnsubscribe: entry.hasListUnsubscribe,
      oneClickSupported: entry.oneClickSupported,
      unsubscribeUrl: entry.unsubscribeUrl,
      unsubscribeMailto: entry.unsubscribeMailto,
      authAligned: entry.authAligned,
      classification,
    }

    await db()
      .insert(senders)
      .values(values)
      .onConflictDoUpdate({
        target: senders.domain,
        set: {
          sampleAddress: values.sampleAddress,
          messageCount: values.messageCount,
          firstSeen: values.firstSeen,
          lastSeen: values.lastSeen,
          hasListUnsubscribe: values.hasListUnsubscribe,
          oneClickSupported: values.oneClickSupported,
          unsubscribeUrl: values.unsubscribeUrl,
          unsubscribeMailto: values.unsubscribeMailto,
          authAligned: values.authAligned,
          classification: values.classification,
          updatedAt: sql`now()`,
        },
      })
  }
}
