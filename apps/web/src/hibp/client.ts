import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db/client"
import { type BreachRecord, breachCache } from "@/db/schema"
import { env } from "@/env"
import { getGmailAccount } from "@/gmail/oauth.ts"

const HIBP_BASE = "https://haveibeenpwned.com/api/v3"
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type BreachLookupResult =
  | { status: "no_key" }
  | { status: "no_email" }
  | { status: "ok"; breaches: BreachRecord[]; fetchedAt: Date; cached: boolean }
  | { status: "error"; message: string }

const hibpResponseSchema = z.array(
  z.object({
    Name: z.string(),
    Title: z.string(),
    BreachDate: z.string(),
    IsVerified: z.boolean(),
    DataClasses: z.array(z.string()),
  }),
)

async function fetchFromHibp(email: string, apiKey: string): Promise<BreachRecord[]> {
  const url = `${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`
  const response = await fetch(url, {
    headers: {
      "hibp-api-key": apiKey,
      // HIBP rejects requests with no User-Agent.
      "User-Agent": "remove-me (personal exposure console)",
    },
  })

  // A clean address, not an error.
  if (response.status === 404) return []

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`HIBP answered ${response.status}: ${detail.slice(0, 200)}`)
  }

  const parsed = hibpResponseSchema.parse(await response.json())
  return parsed.map((breach) => ({
    name: breach.Name,
    title: breach.Title,
    breachDate: breach.BreachDate,
    isVerified: breach.IsVerified,
    dataClasses: breach.DataClasses,
  }))
}

async function readCache() {
  const [cache] = await db().select().from(breachCache).where(eq(breachCache.id, "operator")).limit(1)
  return cache ?? null
}

async function writeCache(breaches: BreachRecord[]): Promise<Date> {
  const fetchedAt = new Date()
  const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS)

  await db()
    .insert(breachCache)
    .values({ id: "operator", fetchedAt, expiresAt, payload: breaches })
    .onConflictDoUpdate({ target: breachCache.id, set: { fetchedAt, expiresAt, payload: breaches } })

  return fetchedAt
}

/**
 * The Breaches screen's single data source. Absent HIBP_API_KEY is not an
 * error — the brief requires the rest of the app to work without one, so
 * this returns a distinct status the page renders as an explanatory empty
 * state instead of throwing.
 */
export async function getBreaches(): Promise<BreachLookupResult> {
  const account = await getGmailAccount()
  if (!account) return { status: "no_email" }

  const cache = await readCache()
  if (cache && cache.expiresAt.getTime() > Date.now()) {
    return { status: "ok", breaches: cache.payload, fetchedAt: cache.fetchedAt, cached: true }
  }

  const { HIBP_API_KEY } = env()
  if (!HIBP_API_KEY) {
    if (cache) return { status: "ok", breaches: cache.payload, fetchedAt: cache.fetchedAt, cached: true }
    return { status: "no_key" }
  }

  try {
    const breaches = await fetchFromHibp(account.emailAddress, HIBP_API_KEY)
    const fetchedAt = await writeCache(breaches)
    return { status: "ok", breaches, fetchedAt, cached: false }
  } catch (error) {
    // A stale cache beats no data at all when HIBP itself is unreachable.
    if (cache) return { status: "ok", breaches: cache.payload, fetchedAt: cache.fetchedAt, cached: true }
    return { status: "error", message: error instanceof Error ? error.message : String(error) }
  }
}
