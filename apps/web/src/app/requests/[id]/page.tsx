import { eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { controller, request } from "@/db/schema"
import { typeNames } from "@/requests/labels"
import {
  createFollowUpAction,
  generateEscalationAction,
  logReplyAction,
  markSentAction,
  resolveRequestAction,
} from "../actions.ts"

export const dynamic = "force-dynamic"

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—")

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row] = await db()
    .select({ req: request, controllerName: controller.name })
    .from(request)
    .innerJoin(controller, eq(request.controllerId, controller.id))
    .where(eq(request.id, id))
  if (!row) notFound()

  const { req, controllerName } = row

  const [followUp] = await db()
    .select({ id: request.id })
    .from(request)
    .where(eq(request.followUpOfId, req.id))

  const promptFollowUp = req.type === "art15" && req.replyAt !== null && !followUp

  return (
    <main>
      <AppNav current="/requests" />
      <h1>
        {typeNames[req.type]} — {controllerName}
      </h1>
      <p className="muted">
        Status: <strong>{req.status}</strong> · created {day(req.createdAt)} · sent{" "}
        {day(req.sentAt)} · deadline {day(req.deadlineAt)}
        {req.followUpOfId ? (
          <>
            {" "}
            · follow-up of <Link href={`/requests/${req.followUpOfId}`}>an Art. 15 request</Link>
          </>
        ) : null}
      </p>

      {promptFollowUp ? (
        <fieldset>
          <legend>Follow up</legend>
          <p>
            The controller has answered this Auskunft. If the disclosed data should go, open an
            erasure request against <strong>{controllerName}</strong> — prefilled with the same
            identifiers.
          </p>
          <form action={createFollowUpAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <button type="submit">Open prefilled Art. 17 follow-up</button>
          </form>
        </fieldset>
      ) : null}

      {followUp ? (
        <p>
          An Art. 17 follow-up exists: <Link href={`/requests/${followUp.id}`}>open it</Link>.
        </p>
      ) : null}

      {req.recheckDue ? (
        <p role="alert">
          Erasure was confirmed more than six months ago. Re-check this controller — re-listing
          after deletion is the norm, not the exception. Log a new exposure or open a fresh Art. 15
          if the data is back.
        </p>
      ) : null}

      <h2>Letter</h2>
      <pre className="letter">{req.body}</pre>

      {req.status === "draft" ? (
        <form action={markSentAction} className="inline">
          <input type="hidden" name="id" value={req.id} />
          <button type="submit">Mark as sent — starts the 1-month deadline</button>
        </form>
      ) : null}

      {req.status === "sent" || req.status === "overdue" || req.status === "responded" ? (
        <form action={logReplyAction}>
          <fieldset>
            <legend>
              {req.replyText ? "Update the controller's reply" : "Log the controller's reply"}
            </legend>
            <p>
              <label htmlFor="reply-date">Reply date</label>
              <br />
              <input id="reply-date" name="replyDate" type="date" required />
            </p>
            <p>
              <label htmlFor="reply-text">Reply text</label>
              <br />
              <textarea
                id="reply-text"
                name="replyText"
                rows={6}
                required
                defaultValue={req.replyText ?? ""}
              />
            </p>
            <input type="hidden" name="id" value={req.id} />
            <button type="submit">Log reply</button>
          </fieldset>
        </form>
      ) : null}

      {req.replyText && req.status !== "responded" ? (
        <>
          <h2>Controller's reply ({day(req.replyAt)})</h2>
          <pre className="letter">{req.replyText}</pre>
        </>
      ) : null}

      {req.status === "responded" ? (
        <div>
          <form action={resolveRequestAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="outcome" value="satisfied" />
            <button type="submit">Satisfied</button>
          </form>{" "}
          <form action={resolveRequestAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="outcome" value="refused" />
            <button type="submit">Refused</button>
          </form>
        </div>
      ) : null}

      {req.status === "overdue" ? (
        <>
          <h2>Escalation — complaint to LfDI Baden-Württemberg</h2>
          {req.escalationDraft ? (
            <>
              <p className="muted">
                Draft only. This app never sends anything — copy it and file the complaint yourself.
              </p>
              <pre className="letter">{req.escalationDraft}</pre>
            </>
          ) : (
            <form action={generateEscalationAction} className="inline">
              <input type="hidden" name="id" value={req.id} />
              <button type="submit">Generate complaint draft</button>
            </form>
          )}
        </>
      ) : null}
    </main>
  )
}
