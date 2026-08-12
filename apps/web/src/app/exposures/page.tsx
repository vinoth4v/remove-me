import { asc, desc, eq } from "drizzle-orm"
import Link from "next/link"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { controller, exposure, identifier, type Removability } from "@/db/schema"
import { addControllerAction, addExposureAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const sourceNames = {
  breach_api: "Breach API",
  art15_disclosure: "Art. 15 disclosure",
  manual: "Checked myself",
} as const

const removabilityBadge: Record<Removability, { label: string; className: string }> = {
  removable: { label: "removable", className: "badge badge-good" },
  suppressible: { label: "suppressible", className: "badge badge-warn" },
  permanent: { label: "permanent", className: "badge badge-stop" },
}

export default async function ExposuresPage() {
  const [exposures, controllers, identifiers] = await Promise.all([
    db()
      .select({
        exposure: exposure,
        controllerName: controller.name,
      })
      .from(exposure)
      .innerJoin(controller, eq(exposure.controllerId, controller.id))
      .orderBy(desc(exposure.createdAt)),
    db().select().from(controller).orderBy(asc(controller.name)),
    db().select().from(identifier).orderBy(asc(identifier.kind)),
  ])

  return (
    <main>
      <AppNav current="/exposures" />
      <h1>Exposures</h1>
      <p className="muted">
        Where your data is known to appear. Sources are limited by design: breach APIs you hold a
        key for, what controllers disclose under Art. 15, and findings you checked yourself. This
        app never crawls, scrapes, or queries people-search services.
      </p>

      {exposures.length === 0 ? (
        <p>No exposures tracked yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Controller</th>
              <th>Source</th>
              <th>Description</th>
              <th>Removability</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {exposures.map(({ exposure: row, controllerName }) => {
              const badge = removabilityBadge[row.removability]
              return (
                <tr key={row.id}>
                  <td>{controllerName}</td>
                  <td>{sourceNames[row.source]}</td>
                  <td>{row.description}</td>
                  <td>
                    <span className={badge.className}>{badge.label}</span>
                    <br />
                    <span className="muted">{row.removabilityReason}</span>
                  </td>
                  <td>
                    {row.removability === "permanent" ? (
                      <span className="muted">
                        No request — an Art. 17(3) exemption applies, so an erasure demand would be
                        legitimately refused. Recorded for awareness.
                      </span>
                    ) : (
                      <Link href={`/requests?exposure=${row.id}`}>Draft request</Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <form action={addExposureAction}>
        <fieldset>
          <legend>Track an exposure</legend>
          {controllers.length === 0 ? (
            <p className="muted">Add a controller below first.</p>
          ) : (
            <>
              <p>
                <label htmlFor="exposure-controller">Controller</label>
                <br />
                <select id="exposure-controller" name="controllerId" required>
                  {controllers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </p>
              <p>
                <label htmlFor="exposure-source">How it was discovered</label>
                <br />
                <select id="exposure-source" name="source" required>
                  <option value="manual">{sourceNames.manual}</option>
                  <option value="art15_disclosure">{sourceNames.art15_disclosure}</option>
                  <option value="breach_api">{sourceNames.breach_api}</option>
                </select>
              </p>
              <p>
                <label htmlFor="exposure-description">Description</label>
                <br />
                <input
                  id="exposure-description"
                  name="description"
                  placeholder="what appears there, e.g. name + old address on a directory page"
                />
              </p>
              <p>
                <span className="muted">Identifiers involved</span>
                <br />
                {identifiers.length === 0 ? (
                  <span className="muted">The vault is empty — add identifiers there first.</span>
                ) : (
                  identifiers.map((i) => (
                    <label key={i.id} className="choice">
                      <input type="checkbox" name="identifierIds" value={i.id} /> {i.kind}:{" "}
                      {i.label}
                    </label>
                  ))
                )}
              </p>
              <p>
                <label htmlFor="exposure-removability">Removability</label>
                <br />
                <select id="exposure-removability" name="removability" required>
                  <option value="removable">
                    removable — commercial controller, no retention obligation
                  </option>
                  <option value="suppressible">
                    suppressible — cannot be deleted at source, but can be delisted from search
                  </option>
                  <option value="permanent">
                    permanent — Art. 17(3) exemption (legal retention, public register, journalism)
                  </option>
                </select>
              </p>
              <p>
                <label htmlFor="exposure-reason">Reason for the rating</label>
                <br />
                <input
                  id="exposure-reason"
                  name="removabilityReason"
                  required
                  placeholder="e.g. Handelsregister entry — statutory public register"
                />
              </p>
              <button type="submit">Track exposure</button>
            </>
          )}
        </fieldset>
      </form>

      <form action={addControllerAction}>
        <fieldset>
          <legend>Add controller</legend>
          <p>
            <label htmlFor="controller-name">Name</label>
            <br />
            <input id="controller-name" name="name" required placeholder="e.g. Acme GmbH" />
          </p>
          <p>
            <label htmlFor="controller-contact">Contact (email or postal address)</label>
            <br />
            <input id="controller-contact" name="contact" placeholder="privacy@acme.example" />
          </p>
          <p>
            <label htmlFor="controller-notes">Notes</label>
            <br />
            <input id="controller-notes" name="notes" />
          </p>
          <button type="submit">Add controller</button>
        </fieldset>
      </form>
    </main>
  )
}
