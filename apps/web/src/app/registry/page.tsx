import { asc } from "drizzle-orm"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { type RegistryStatus, registryItem } from "@/db/schema"
import { ensureRegistrySeeded } from "@/registry/seed"
import { markRegistryDoneAction, reopenRegistryAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const statusBadge: Record<RegistryStatus, { label: string; className: string }> = {
  open: { label: "open", className: "badge" },
  done: { label: "done", className: "badge badge-good" },
  renewal_due: { label: "renewal due", className: "badge badge-stop" },
}

function renewalLabel(months: number | null): string {
  if (months === null) return "indefinite"
  if (months % 12 === 0) return `every ${months / 12} year${months === 12 ? "" : "s"}`
  return `every ${months} months`
}

export default async function RegistryPage() {
  await ensureRegistrySeeded()
  const rows = await db().select().from(registryItem).orderBy(asc(registryItem.name))

  return (
    <main>
      <AppNav current="/registry" />
      <h1>Opt-out registry</h1>
      <p className="muted">
        Known German opt-out actions — a tracked checklist, deliberately not automated. Open the
        link, do the action yourself, then record it here. The weekly check flags entries past their
        renewal interval.
      </p>

      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Covers</th>
            <th>Renewal</th>
            <th>Status</th>
            <th>Last action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = statusBadge[row.status]
            return (
              <tr key={row.id}>
                <td>
                  <a href={row.deepLink} target="_blank" rel="noreferrer">
                    {row.name}
                  </a>
                  {row.notes ? (
                    <>
                      <br />
                      <span className="muted">{row.notes}</span>
                    </>
                  ) : null}
                </td>
                <td>{row.covers.join(", ")}</td>
                <td>{renewalLabel(row.renewalMonths)}</td>
                <td>
                  <span className={badge.className}>{badge.label}</span>
                </td>
                <td>{row.lastActionAt ? row.lastActionAt.toISOString().slice(0, 10) : "—"}</td>
                <td>
                  <form action={markRegistryDoneAction} className="inline">
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit">Done today</button>
                  </form>{" "}
                  {row.status !== "open" ? (
                    <form action={reopenRegistryAction} className="inline">
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit">Reopen</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </main>
  )
}
