import { asc, desc, eq } from "drizzle-orm"
import Link from "next/link"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { controller, exposure, identifier, type Removability } from "@/db/schema"
import { removabilityLabels } from "@/requests/labels"
import { addExposureAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const sourceNames = {
  manual: "I found it myself",
  art15_disclosure: "A company told me (after I asked)",
  breach_api: "A data-breach alert",
} as const

const removabilityBadge: Record<Removability, string> = {
  removable: "badge badge-good",
  suppressible: "badge badge-warn",
  permanent: "badge badge-stop",
}

export default async function ExposuresPage() {
  const [exposures, identifiers] = await Promise.all([
    db()
      .select({ exposure: exposure, controllerName: controller.name })
      .from(exposure)
      .innerJoin(controller, eq(exposure.controllerId, controller.id))
      .orderBy(desc(exposure.createdAt)),
    db().select().from(identifier).orderBy(asc(identifier.kind)),
  ])

  return (
    <main>
      <AppNav current="/exposures" />
      <h1>Who has my data</h1>
      <p className="muted">
        Keep a simple list of every company, directory or website where your data shows up. You add
        entries yourself — from things you spot, from data-breach alerts, or from what companies
        admit when you ask them. The app never searches the internet for you: that would mean
        handing your data to yet more services.
      </p>

      {exposures.length === 0 ? (
        <p>
          Nothing listed yet. Think of newsletters you never signed up for, old accounts, phone
          books, or people-search sites you have seen yourself in — and add them below.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Who</th>
              <th>What you found</th>
              <th>Can it be removed?</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {exposures.map(({ exposure: row, controllerName }) => (
              <tr key={row.id}>
                <td>
                  {controllerName}
                  <br />
                  <span className="muted">{sourceNames[row.source]}</span>
                </td>
                <td>{row.description}</td>
                <td>
                  <span className={removabilityBadge[row.removability]}>
                    {removabilityLabels[row.removability]}
                  </span>
                  <br />
                  <span className="muted">{row.removabilityReason}</span>
                </td>
                <td>
                  {row.removability === "permanent" ? (
                    <span className="muted">
                      Nothing to send — the law lets them keep this, so a deletion demand would only
                      be refused. It stays on your list so you keep the overview.
                    </span>
                  ) : (
                    <Link href={`/requests?exposure=${row.id}`}>Write them a letter</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={addExposureAction}>
        <fieldset>
          <legend>Add an entry</legend>
          <p>
            <label htmlFor="exposure-company">Who has your data?</label>
            <br />
            <input
              id="exposure-company"
              name="companyName"
              required
              placeholder="e.g. Acme Marketing GmbH, dastelefonbuch.de"
            />
          </p>
          <p>
            <label htmlFor="exposure-contact">Their email address, if you know it (optional)</label>
            <br />
            <input
              id="exposure-contact"
              name="contact"
              placeholder="often datenschutz@… or privacy@… — check their Impressum page"
            />
          </p>
          <p>
            <label htmlFor="exposure-description">What did you find there?</label>
            <br />
            <input
              id="exposure-description"
              name="description"
              placeholder="e.g. my name and old address on their people-search page"
            />
          </p>
          <p>
            <label htmlFor="exposure-source">How did you find out?</label>
            <br />
            <select id="exposure-source" name="source" required>
              <option value="manual">{sourceNames.manual}</option>
              <option value="art15_disclosure">{sourceNames.art15_disclosure}</option>
              <option value="breach_api">{sourceNames.breach_api}</option>
            </select>
          </p>
          <p>
            <span className="muted">Which of your details do they have?</span>
            <br />
            {identifiers.length === 0 ? (
              <span className="muted">
                First add your details under <Link href="/vault">My details</Link>.
              </span>
            ) : (
              identifiers.map((i) => (
                <label key={i.id} className="choice">
                  <input type="checkbox" name="identifierIds" value={i.id} /> {i.label}
                </label>
              ))
            )}
          </p>
          <p>
            <span className="muted">Can it be removed? If unsure, keep the first option.</span>
            <br />
            <label className="choice">
              <input type="radio" name="removability" value="removable" defaultChecked /> Yes —
              it&apos;s a normal company or website ({removabilityLabels.removable})
            </label>
            <label className="choice">
              <input type="radio" name="removability" value="suppressible" /> Not at the source, but
              Google can stop showing it ({removabilityLabels.suppressible})
            </label>
            <label className="choice">
              <input type="radio" name="removability" value="permanent" /> No — it&apos;s an
              official public record, e.g. a company register or news article (
              {removabilityLabels.permanent})
            </label>
          </p>
          <p>
            <label htmlFor="exposure-reason">Why? (optional — the app fills in a default)</label>
            <br />
            <input id="exposure-reason" name="removabilityReason" />
          </p>
          <button type="submit">Add to my list</button>
        </fieldset>
      </form>
    </main>
  )
}
