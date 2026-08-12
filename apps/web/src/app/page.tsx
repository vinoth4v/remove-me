import { eq } from "drizzle-orm"
import Link from "next/link"
import { signOutAction } from "@/app/actions"
import { AppNav } from "@/app/nav"
import { auth } from "@/auth"
import { db } from "@/db/client"
import { exposure, identifier, registryItem, request } from "@/db/schema"

// Reads the session cookie and the database, so there is nothing to prerender.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  const [identifiers, exposures, requests, renewalsDue] = await Promise.all([
    db().select({ id: identifier.id }).from(identifier),
    db().select({ id: exposure.id, removability: exposure.removability }).from(exposure),
    db()
      .select({ id: request.id, status: request.status, recheckDue: request.recheckDue })
      .from(request),
    db()
      .select({ id: registryItem.id })
      .from(registryItem)
      .where(eq(registryItem.status, "renewal_due")),
  ])

  const overdue = requests.filter((r) => r.status === "overdue").length
  const open = requests.filter((r) => r.status === "draft" || r.status === "sent").length
  const rechecks = requests.filter((r) => r.recheckDue).length
  const permanent = exposures.filter((e) => e.removability === "permanent").length

  return (
    <main>
      <AppNav current="/" />
      <h1>Remove Me</h1>
      <p className="muted">
        Signed in as <strong>{session?.user?.email ?? "unknown"}</strong>. Identity vault, DSGVO
        request orchestrator, and opt-out registry — discovery only through breach APIs, Art. 15
        disclosures, and your own findings, never by scraping.
      </p>

      <div className="stat-grid">
        <Link href="/vault">
          <strong>{identifiers.length}</strong> vault identifiers
        </Link>
        <Link href="/exposures">
          <strong>{exposures.length}</strong> exposures tracked
          {permanent > 0 ? <span className="muted"> ({permanent} permanent)</span> : null}
        </Link>
        <Link href="/requests">
          <strong>{open}</strong> requests in flight
        </Link>
        <Link href="/registry">
          <strong>{renewalsDue.length}</strong> registry renewals due
        </Link>
      </div>

      {overdue > 0 ? (
        <p role="alert">
          {overdue} request{overdue === 1 ? " is" : "s are"} past the one-month deadline —{" "}
          <Link href="/requests">escalation drafts are ready</Link>.
        </p>
      ) : null}

      {rechecks > 0 ? (
        <p role="alert">
          {rechecks} confirmed erasure{rechecks === 1 ? "" : "s"} older than six months —{" "}
          <Link href="/requests">re-check for re-listing</Link>.
        </p>
      ) : null}

      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
