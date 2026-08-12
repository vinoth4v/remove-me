import { NextResponse } from "next/server"
import { env } from "@/env"
import { sweepOverdueGdprRequests } from "@/gdpr/tracker.ts"
import { getGmailAccount } from "@/gmail/oauth.ts"
import { runScan } from "@/gmail/scan.ts"
import { getBreaches } from "@/hibp/client.ts"

// The one Vercel Cron entry the brief allows: continues the Gmail scan,
// refreshes the breach cache once it is 7 days stale, and marks overdue GDPR
// requests. Not in proxy.ts's protected matcher — Vercel Cron has no
// session, so CRON_SECRET is the gate instead.
export const maxDuration = 60

export async function GET(request: Request) {
  const { CRON_SECRET } = env()
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 404 })
  }
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const overdueMarked = await sweepOverdueGdprRequests()

  const account = await getGmailAccount()
  const scan = account ? await runScan() : null

  // getBreaches() already no-ops when the cache is fresh or no key is set.
  const breaches = await getBreaches()

  return NextResponse.json({ overdueMarked, scan, breachStatus: breaches.status })
}
