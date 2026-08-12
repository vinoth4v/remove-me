import { asc, desc, eq, ne } from "drizzle-orm"
import Link from "next/link"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { controller, exposure, identifier, type RequestStatus, request } from "@/db/schema"
import { plainTypeNames, statusLabels, typeHints, typeNames } from "@/requests/labels"
import { createRequestAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const statusBadge: Record<RequestStatus, string> = {
  draft: "badge",
  sent: "badge badge-warn",
  responded: "badge badge-warn",
  satisfied: "badge badge-good",
  refused: "badge badge-stop",
  overdue: "badge badge-stop",
}

const errors: Record<string, string> = {
  permanent:
    "That entry is an official public record — the law lets them keep it, so the app will not write a deletion demand that would only be refused.",
  exposure_missing: "That entry no longer exists.",
  controller_missing: "That company no longer exists.",
  not_art15: "A follow-up can only be created from an “Ask what they know about me” request.",
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exposure?: string }>
}) {
  const { error, exposure: exposureParam } = await searchParams

  const [rows, controllers, identifiers, exposures] = await Promise.all([
    db()
      .select({ req: request, controllerName: controller.name })
      .from(request)
      .innerJoin(controller, eq(request.controllerId, controller.id))
      .orderBy(desc(request.createdAt)),
    db().select().from(controller).orderBy(asc(controller.name)),
    db().select().from(identifier).orderBy(asc(identifier.kind)),
    // Entries the law protects are not offered at all — the classifier decides.
    db().select().from(exposure).where(ne(exposure.removability, "permanent")),
  ])

  const prefill = exposures.find((e) => e.id === exposureParam)

  return (
    <main>
      <AppNav current="/requests" />
      <h1>My requests</h1>
      <p className="muted">
        The app writes formal letters for you, in proper legal language. You copy each letter into
        an email (or print it), send it yourself, and record here what happens. Companies must
        answer within one month — the app watches that deadline for you.
      </p>

      {error && errors[error] ? <p role="alert">{errors[error]}</p> : null}

      {rows.length === 0 ? (
        <p>No letters yet — write your first one below.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>What you asked</th>
              <th>Where it stands</th>
              <th>Answer due by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ req, controllerName }) => (
              <tr key={req.id}>
                <td>{controllerName}</td>
                <td>
                  {plainTypeNames[req.type]}
                  <br />
                  <span className="muted">{typeNames[req.type]}</span>
                </td>
                <td>
                  <span className={statusBadge[req.status]}>{statusLabels[req.status]}</span>
                  {req.recheckDue ? (
                    <>
                      {" "}
                      <span className="badge badge-warn">worth re-checking</span>
                    </>
                  ) : null}
                </td>
                <td>{req.deadlineAt ? req.deadlineAt.toISOString().slice(0, 10) : "—"}</td>
                <td>
                  <Link href={`/requests/${req.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={createRequestAction}>
        <fieldset>
          <legend>Write a new letter</legend>
          {controllers.length === 0 || identifiers.length === 0 ? (
            <p className="muted">
              Two quick things first: add your details under <Link href="/vault">My details</Link>,
              and add at least one company under <Link href="/exposures">Who has my data</Link>.
              Then the app can write letters for you.
            </p>
          ) : (
            <>
              {prefill ? <input type="hidden" name="exposureId" value={prefill.id} /> : null}
              <p>
                <label htmlFor="request-controller">Which company?</label>
                <br />
                <select
                  id="request-controller"
                  name="controllerId"
                  required
                  defaultValue={prefill?.controllerId}
                >
                  {controllers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </p>
              <p>
                <span className="muted">What do you want?</span>
                <br />
                {(["art15", "art17", "art21", "art16"] as const).map((type, index) => (
                  <label key={type} className="choice">
                    <input type="radio" name="type" value={type} defaultChecked={index === 0} />{" "}
                    <strong>{plainTypeNames[type]}</strong>{" "}
                    <span className="muted">({typeNames[type]})</span>
                    <br />
                    <span className="muted choice-hint">{typeHints[type]}</span>
                  </label>
                ))}
              </p>
              <p>
                <label htmlFor="request-language">Letter language</label>
                <br />
                <select id="request-language" name="language" required>
                  <option value="de">German — best for companies in Germany</option>
                  <option value="en">English</option>
                </select>
              </p>
              <p>
                <span className="muted">
                  Which of your details should the letter mention? (Pick the ones this company has —
                  it helps them find you in their systems.)
                </span>
                <br />
                {identifiers.map((i) => (
                  <label key={i.id} className="choice">
                    <input
                      type="checkbox"
                      name="identifierIds"
                      value={i.id}
                      defaultChecked={prefill?.identifierIds.includes(i.id)}
                    />{" "}
                    {i.label}
                  </label>
                ))}
              </p>
              <p>
                <label htmlFor="request-details">
                  Anything to add? (optional — for corrections, say what is wrong and what is right)
                </label>
                <br />
                <textarea id="request-details" name="details" rows={3} />
              </p>
              <button type="submit">Write my letter</button>
            </>
          )}
        </fieldset>
      </form>
    </main>
  )
}
