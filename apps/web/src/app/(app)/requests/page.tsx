import type { GdprRequestRow, GdprStatus } from "@/db/schema"
import { createGdprRequestAction, markRespondedAction, markSentAction } from "@/gdpr/actions.ts"
import { listGdprRequests } from "@/gdpr/tracker.ts"
import { listSenders } from "@/senders/queries.ts"
import { Badge, gdprStatusVariant } from "../badge.tsx"

export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

function countdownLabel(status: GdprStatus, responseDueAt: Date | null): string {
  if (status === "draft") return "Not sent"
  if (status === "responded") return "Responded"
  if (!responseDueAt) return "—"

  const daysRemaining = Math.ceil((responseDueAt.getTime() - Date.now()) / DAY_MS)
  if (daysRemaining < 0) {
    const daysOverdue = Math.abs(daysRemaining)
    return `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
  }
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
}

function RequestActions({ request }: { request: Pick<GdprRequestRow, "id" | "status"> }) {
  if (request.status === "draft") {
    return (
      <form action={markSentAction.bind(null, request.id)} className="inline">
        <button type="submit">Mark sent</button>
      </form>
    )
  }
  if (request.status === "sent" || request.status === "overdue") {
    return (
      <form action={markRespondedAction.bind(null, request.id)} className="inline">
        <button type="submit" className="button-quiet">
          Mark responded
        </button>
      </form>
    )
  }
  return null
}

export default async function RequestsPage() {
  const [requests, senderRows] = await Promise.all([listGdprRequests(), listSenders()])

  return (
    <>
      <h1>Requests</h1>

      <h2>Generate a request</h2>
      <form action={createGdprRequestAction}>
        <p>
          <label htmlFor="senderId">Sender (optional)</label>
          <br />
          <select id="senderId" name="senderId" defaultValue="">
            <option value="">— none —</option>
            {senderRows.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.domain}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="controllerName">Controller name</label>
          <br />
          <input id="controllerName" name="controllerName" required placeholder="e.g. Example GmbH" />
        </p>
        <p>
          <label htmlFor="article">Article</label>
          <br />
          <select id="article" name="article" defaultValue="art17">
            <option value="art17">Article 17 — Erasure</option>
            <option value="art21">Article 21 — Objection to direct marketing</option>
          </select>
        </p>
        <p>
          <label htmlFor="language">Language</label>
          <br />
          <select id="language" name="language" defaultValue="en">
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </p>
        <button type="submit">Generate</button>
      </form>

      <hr />

      <h2>Tracker</h2>
      {requests.length === 0 ? (
        <div className="empty-state">
          <p>No requests yet — generate one above.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Controller</th>
              <th>Article</th>
              <th>Language</th>
              <th>Status</th>
              <th>Response window</th>
              <th>Text</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.controllerName}
                  {request.senderDomain ? <div className="fine-print">{request.senderDomain}</div> : null}
                </td>
                <td>{request.article === "art17" ? "Art. 17" : "Art. 21"}</td>
                <td>{request.language.toUpperCase()}</td>
                <td>
                  <Badge variant={gdprStatusVariant(request.status)}>{request.status}</Badge>
                </td>
                <td>{countdownLabel(request.status, request.responseDueAt)}</td>
                <td>
                  <textarea readOnly rows={4} className="request-text" value={request.body} />
                </td>
                <td>
                  <RequestActions request={request} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
