import { asc } from "drizzle-orm"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { type RegistryStatus, registryItem } from "@/db/schema"
import { ensureRegistrySeeded } from "@/registry/seed"
import { markRegistryDoneAction, reopenRegistryAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const statusBadge: Record<RegistryStatus, { label: string; className: string }> = {
  open: { label: "still to do", className: "badge" },
  done: { label: "done", className: "badge badge-good" },
  renewal_due: { label: "do it again", className: "badge badge-stop" },
}

function renewalLabel(months: number | null): string {
  if (months === null) return "lasts forever"
  if (months % 12 === 0) return `redo every ${months / 12 === 1 ? "year" : `${months / 12} years`}`
  return `redo every ${months} months`
}

export default async function RegistryPage() {
  await ensureRegistrySeeded()
  const rows = await db().select().from(registryItem).orderBy(asc(registryItem.name))

  return (
    <main>
      <AppNav current="/registry" />
      <h1>Easy wins</h1>
      <p className="muted">
        Six free opt-outs that stop most advertising post, spam and directory listings in Germany —
        no letters needed. For each one: open the link, follow the steps on their site, then come
        back and press “I did it”. The app reminds you when one expires.
      </p>

      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Protects</th>
            <th>How long it lasts</th>
            <th>Status</th>
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
                    {row.name} ↗
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
                  {row.lastActionAt ? (
                    <>
                      <br />
                      <span className="muted">
                        last done {row.lastActionAt.toISOString().slice(0, 10)}
                      </span>
                    </>
                  ) : null}
                </td>
                <td>
                  <form action={markRegistryDoneAction} className="inline">
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit">I did it</button>
                  </form>{" "}
                  {row.status !== "open" ? (
                    <form action={reopenRegistryAction} className="inline">
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit">Undo</button>
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
