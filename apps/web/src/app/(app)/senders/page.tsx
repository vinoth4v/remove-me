import type { SenderRow } from "@/db/schema"
import { listRecentUnsubscribeAttempts, listSenders } from "@/senders/queries.ts"
import { blockAction, runBulkUnsubscribeAction, unsubscribeAction } from "@/unsubscribe/actions.ts"
import { BLOCK_REASON, decideUnsubscribeMethod, type UnsubscribeDecision } from "@/unsubscribe/engine.ts"
import { Badge, classificationVariant } from "../badge.tsx"

export const dynamic = "force-dynamic"

function methodLabel(decision: UnsubscribeDecision): string {
  if (decision.method === "one_click_post") return "One-click (automatic)"
  if (decision.method === "manual_link") return "Manual link"
  if (decision.method === "mailto") return "Manual (mailto)"
  return "—"
}

function Action({ sender, decision }: { sender: SenderRow; decision: UnsubscribeDecision }) {
  if (sender.status === "unsubscribed") return <span className="fine-print">Unsubscribed</span>
  if (sender.status === "blocked") return <span className="fine-print">Blocked</span>

  if (decision.method === "one_click_post") {
    return (
      <form action={unsubscribeAction.bind(null, sender.id)} className="inline">
        <button type="submit">Unsubscribe</button>
      </form>
    )
  }

  if (decision.method === "manual_link") {
    return (
      <a href={decision.url} target="_blank" rel="noreferrer noopener">
        Open unsubscribe link
      </a>
    )
  }

  if (decision.method === "mailto") {
    return <span className="fine-print">Email {decision.address}</span>
  }

  return (
    <>
      <form action={blockAction.bind(null, sender.id)} className="inline">
        <button type="submit" className="button-quiet">
          Block
        </button>
      </form>
      <p className="fine-print">{BLOCK_REASON}</p>
    </>
  )
}

export default async function SendersPage() {
  const [senderRows, attempts] = await Promise.all([listSenders(), listRecentUnsubscribeAttempts()])

  return (
    <>
      <h1>Senders</h1>

      {senderRows.length === 0 ? (
        <div className="empty-state">
          <p>No senders yet. Connect Gmail and run a scan from the Exposure screen.</p>
        </div>
      ) : (
        <>
          <form action={runBulkUnsubscribeAction} className="inline">
            <button type="submit">Unsubscribe from all eligible senders</button>
          </form>
          <p className="fine-print">
            Up to 50 one-click unsubscribes per run, one second apart, per RFC 8058 — only ever sent
            to senders classified legitimate.
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Messages</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Unsubscribe method</th>
                <th>Classification</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {senderRows.map((sender) => {
                const decision = decideUnsubscribeMethod(sender)
                return (
                  <tr key={sender.id}>
                    <td>{sender.domain}</td>
                    <td className="num">{sender.messageCount}</td>
                    <td className="num">{sender.firstSeen.toLocaleDateString("en-GB")}</td>
                    <td className="num">{sender.lastSeen.toLocaleDateString("en-GB")}</td>
                    <td>{methodLabel(decision)}</td>
                    <td>
                      <Badge variant={classificationVariant(sender.classification)}>
                        {sender.classification}
                      </Badge>
                    </td>
                    <td>
                      <Action sender={sender} decision={decision} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <h2>Unsubscribe &amp; block log</h2>
      {attempts.length === 0 ? (
        <p className="fine-print">No attempts yet.</p>
      ) : (
        <ul className="audit-log">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <span className="num">{attempt.at.toLocaleString("en-GB")}</span> — {attempt.senderDomain} —{" "}
              {attempt.method}
              {attempt.httpStatus ? ` — HTTP ${attempt.httpStatus}` : ""}
              {attempt.detail ? ` — ${attempt.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
