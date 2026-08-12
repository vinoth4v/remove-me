import { eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AppNav } from "@/app/nav"
import { CopyButton } from "@/components/copy-button"
import { db } from "@/db/client"
import { controller, request } from "@/db/schema"
import { plainTypeNames, statusLabels, typeNames } from "@/requests/labels"
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
    .select({
      req: request,
      controllerContact: controller.contact,
      controllerName: controller.name,
    })
    .from(request)
    .innerJoin(controller, eq(request.controllerId, controller.id))
    .where(eq(request.id, id))
  if (!row) notFound()

  const { req, controllerName, controllerContact } = row

  const [followUp] = await db()
    .select({ id: request.id })
    .from(request)
    .where(eq(request.followUpOfId, req.id))

  const promptFollowUp = req.type === "art15" && req.replyAt !== null && !followUp
  const emailContact = controllerContact?.includes("@") ? controllerContact : null
  const [subjectLine] = req.body.split("\n")
  const mailtoHref = emailContact
    ? `mailto:${emailContact}?subject=${encodeURIComponent(subjectLine ?? "")}&body=${encodeURIComponent(req.body)}`
    : null

  return (
    <main>
      <AppNav current="/requests" />
      <h1>
        {plainTypeNames[req.type]} — {controllerName}
      </h1>
      <p className="muted">
        {typeNames[req.type]} · Status: <strong>{statusLabels[req.status]}</strong> · written{" "}
        {day(req.createdAt)}
        {req.sentAt ? ` · sent ${day(req.sentAt)}` : ""}
        {req.deadlineAt ? ` · answer due by ${day(req.deadlineAt)}` : ""}
        {req.followUpOfId ? (
          <>
            {" "}
            · follows up on <Link href={`/requests/${req.followUpOfId}`}>an earlier request</Link>
          </>
        ) : null}
      </p>

      {req.status === "draft" ? (
        <div className="hint">
          <strong>What to do now</strong>
          <ol className="steps-plain">
            <li>Copy the letter below.</li>
            <li>
              {emailContact
                ? `Email it to ${emailContact} (the button does both at once), or print and post it.`
                : "Email it to the company's privacy address (often datenschutz@… or privacy@…, listed in their Impressum or privacy policy), or print and post it."}
            </li>
            <li>Come back and press “I sent it” so the app can watch the deadline.</li>
          </ol>
          <CopyButton text={req.body} label="Copy the letter" />{" "}
          {mailtoHref ? (
            <a className="button-secondary" href={mailtoHref}>
              Open in my email app
            </a>
          ) : null}{" "}
          <form action={markSentAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <button type="submit">I sent it</button>
          </form>
        </div>
      ) : null}

      {req.status === "sent" ? (
        <p className="hint">
          ⏳ Waiting for their answer — they must reply by <strong>{day(req.deadlineAt)}</strong>.
          When anything arrives, paste it below. If the date passes, the app flags it and prepares a
          free complaint letter for you.
        </p>
      ) : null}

      {promptFollowUp ? (
        <div className="hint">
          <strong>They told you what they have.</strong> If you want that data gone, the app can
          write the deletion demand against {controllerName} right away — already filled in with the
          same details.
          <br />
          <form action={createFollowUpAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <button type="submit">Write the deletion letter</button>
          </form>
        </div>
      ) : null}

      {followUp ? (
        <p>
          A deletion letter exists for this: <Link href={`/requests/${followUp.id}`}>open it</Link>.
        </p>
      ) : null}

      {req.recheckDue ? (
        <p role="alert">
          They confirmed deletion more than six months ago. Data often quietly comes back — worth
          searching for yourself again. If it is back, write them a fresh letter.
        </p>
      ) : null}

      <h2>The letter</h2>
      <pre className="letter">{req.body}</pre>

      {req.status === "sent" || req.status === "overdue" || req.status === "responded" ? (
        <form action={logReplyAction}>
          <fieldset>
            <legend>
              {req.replyText ? "Update their answer" : "They answered? Paste it here"}
            </legend>
            <p>
              <label htmlFor="reply-date">When did the answer arrive?</label>
              <br />
              <input id="reply-date" name="replyDate" type="date" required />
            </p>
            <p>
              <label htmlFor="reply-text">What did they say? (paste their reply)</label>
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
            <button type="submit">Save their answer</button>
          </fieldset>
        </form>
      ) : null}

      {req.replyText && req.status !== "responded" ? (
        <>
          <h2>Their answer ({day(req.replyAt)})</h2>
          <pre className="letter">{req.replyText}</pre>
        </>
      ) : null}

      {req.status === "responded" ? (
        <div className="hint">
          <strong>Did they actually do what you asked?</strong>
          <br />
          <form action={resolveRequestAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="outcome" value="satisfied" />
            <button type="submit">Yes, done</button>
          </form>{" "}
          <form action={resolveRequestAction} className="inline">
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="outcome" value="refused" />
            <button type="submit">No, they refused</button>
          </form>
        </div>
      ) : null}

      {req.status === "overdue" ? (
        <>
          <h2>They missed the legal deadline</h2>
          <p className="muted">
            You can now complain to the privacy authority (LfDI Baden-Württemberg) — it is free and
            often gets things moving. The letter below is ready: copy it and send it yourself, the
            app never sends anything.
          </p>
          {req.escalationDraft ? (
            <>
              <CopyButton text={req.escalationDraft} label="Copy the complaint" />
              <pre className="letter">{req.escalationDraft}</pre>
            </>
          ) : (
            <form action={generateEscalationAction} className="inline">
              <input type="hidden" name="id" value={req.id} />
              <button type="submit">Prepare the complaint letter</button>
            </form>
          )}
        </>
      ) : null}
    </main>
  )
}
