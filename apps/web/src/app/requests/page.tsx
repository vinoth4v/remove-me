import { asc, desc, eq, ne } from "drizzle-orm"
import Link from "next/link"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { controller, exposure, identifier, type RequestStatus, request } from "@/db/schema"
import { typeNames } from "@/requests/labels"
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
    "That exposure is classified permanent — an Art. 17(3) exemption applies, so no request can be created against it.",
  exposure_missing: "That exposure no longer exists.",
  controller_missing: "That controller no longer exists.",
  not_art15: "A follow-up can only be created from an Art. 15 request.",
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
    // Permanent exposures are not offered at all — the classifier decides.
    db().select().from(exposure).where(ne(exposure.removability, "permanent")),
  ])

  const prefill = exposures.find((e) => e.id === exposureParam)

  return (
    <main>
      <AppNav current="/requests" />
      <h1>Requests</h1>

      {error && errors[error] ? <p role="alert">{errors[error]}</p> : null}

      {rows.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Controller</th>
              <th>Type</th>
              <th>Status</th>
              <th>Deadline</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ req, controllerName }) => (
              <tr key={req.id}>
                <td>{controllerName}</td>
                <td>
                  {typeNames[req.type]} ({req.language})
                </td>
                <td>
                  <span className={statusBadge[req.status]}>{req.status}</span>
                  {req.recheckDue ? (
                    <>
                      {" "}
                      <span className="badge badge-warn">re-check due</span>
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
          <legend>New request</legend>
          {controllers.length === 0 || identifiers.length === 0 ? (
            <p className="muted">
              You need at least one <Link href="/exposures">controller</Link> and one{" "}
              <Link href="/vault">vault identifier</Link> before drafting a request.
            </p>
          ) : (
            <>
              {prefill ? <input type="hidden" name="exposureId" value={prefill.id} /> : null}
              <p>
                <label htmlFor="request-controller">Controller</label>
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
                <label htmlFor="request-type">Request type</label>
                <br />
                <select id="request-type" name="type" required>
                  <option value="art15">{typeNames.art15} — full copy of held data + source</option>
                  <option value="art17">{typeNames.art17} — erasure</option>
                  <option value="art21">{typeNames.art21} — objection to direct marketing</option>
                  <option value="art16">{typeNames.art16} — correction of wrong data</option>
                </select>
              </p>
              <p>
                <label htmlFor="request-language">Language</label>
                <br />
                <select id="request-language" name="language" required>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </p>
              <p>
                <span className="muted">Identifiers to include</span>
                <br />
                {identifiers.map((i) => (
                  <label key={i.id} className="choice">
                    <input
                      type="checkbox"
                      name="identifierIds"
                      value={i.id}
                      defaultChecked={prefill?.identifierIds.includes(i.id)}
                    />{" "}
                    {i.kind}: {i.label}
                  </label>
                ))}
              </p>
              <p>
                <label htmlFor="request-details">Additional details (optional)</label>
                <br />
                <textarea
                  id="request-details"
                  name="details"
                  rows={3}
                  placeholder="for Art. 16: what is wrong and what is correct"
                />
              </p>
              <button type="submit">Generate draft</button>
            </>
          )}
        </fieldset>
      </form>
    </main>
  )
}
