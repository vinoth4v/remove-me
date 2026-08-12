import { desc } from "drizzle-orm"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { type BulkSenderRow, bulkSender, gmailConnection } from "@/db/schema"
import { googleConfigured } from "@/inbox/gmail"
import { decryptIdentifier } from "@/vault/crypto"
import {
  disconnectGmailAction,
  keepSenderAction,
  markUnsubscribedAction,
  scanInboxAction,
  unsubscribeAllAction,
  unsubscribeOneClickAction,
} from "./actions.ts"

export const dynamic = "force-dynamic"
// A scan fetches up to 100 message headers from Gmail.
export const maxDuration = 60

const errors: Record<string, string> = {
  denied: "Google connection was cancelled — nothing was linked.",
  connect_failed: "Connecting to Google did not work. Try again.",
  not_connected: "Connect your Gmail first.",
  scan_failed: "The scan failed — reconnect your Gmail and try again.",
  unsubscribe_failed:
    "That sender's unsubscribe service did not answer properly. Use the link on one of their emails instead, then press “I did it myself”.",
  not_one_click: "This sender has no one-click unsubscribe — use the email or link option.",
}

function decryptOrNull(value: string | null): string | null {
  if (!value) return null
  try {
    return decryptIdentifier(value)
  } catch {
    return null
  }
}

function SenderActions({ row }: { row: BulkSenderRow }) {
  const mailto = decryptOrNull(row.unsubscribeMailtoEncrypted)
  const url = decryptOrNull(row.unsubscribeUrlEncrypted)

  if (row.status !== "new") {
    return (
      <span className="muted">{row.actedAt ? row.actedAt.toISOString().slice(0, 10) : ""}</span>
    )
  }

  return (
    <>
      {row.oneClick ? (
        <form action={unsubscribeOneClickAction} className="inline">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit">Unsubscribe</button>
        </form>
      ) : mailto ? (
        <a
          className="button-secondary"
          href={`mailto:${mailto}?subject=unsubscribe&body=${encodeURIComponent("Please unsubscribe me from this mailing list.")}`}
        >
          Send unsubscribe email
        </a>
      ) : url ? (
        <a className="button-secondary" href={url} target="_blank" rel="noreferrer">
          Open their unsubscribe page ↗
        </a>
      ) : null}{" "}
      {!row.oneClick ? (
        <form action={markUnsubscribedAction} className="inline">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit">I did it myself</button>
        </form>
      ) : null}{" "}
      <form action={keepSenderAction} className="inline">
        <input type="hidden" name="id" value={row.id} />
        <button type="submit">Keep</button>
      </form>
    </>
  )
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    scanned?: string
    senders?: string
    bulk_done?: string
    bulk_total?: string
  }>
}) {
  const params = await searchParams
  const configured = googleConfigured()
  const [connection] = configured ? await db().select().from(gmailConnection) : [undefined]
  const senders = connection
    ? await db().select().from(bulkSender).orderBy(desc(bulkSender.messageCount))
    : []

  const pending = senders.filter((s) => s.status === "new")
  const oneClickPending = pending.filter((s) => s.oneClick)

  return (
    <main>
      <AppNav current="/inbox" />
      <h1>Inbox unsubscribe</h1>
      <p className="muted">
        Connect your Gmail and the app finds the newsletters and advertisers filling your inbox —
        then unsubscribes with one click where the sender supports it. Reading only: the app can
        never send, delete or change your mail.
      </p>

      {params.error && errors[params.error] ? <p role="alert">{errors[params.error]}</p> : null}
      {params.scanned ? (
        <p className="hint">
          ✓ Looked at {params.scanned} emails and found {params.senders} senders. Scan again to go
          further back.
        </p>
      ) : null}
      {params.bulk_done ? (
        <p className="hint">
          ✓ Unsubscribed from {params.bulk_done} of {params.bulk_total} senders. Any that failed
          stay in the list — use their email or link option.
        </p>
      ) : null}

      {!configured ? (
        <div className="hint">
          <strong>One-time setup needed (about 10 minutes)</strong>
          <ol className="steps-plain">
            <li>
              Go to{" "}
              <a href="https://console.cloud.google.com/apis/credentials">
                Google Cloud Console → Credentials
              </a>{" "}
              and create an “OAuth client ID” of type “Web application”.
            </li>
            <li>
              Add this app's address followed by <code>/api/google/callback</code> as an authorised
              redirect URI (do the same for <code>http://localhost:3000</code> if you develop
              locally), and enable the “Gmail API” for the project.
            </li>
            <li>
              Put the client ID and secret into the app's environment as{" "}
              <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> (on Vercel:
              Settings → Environment Variables, then redeploy).
            </li>
          </ol>
          Then reload this page — a “Connect my Gmail” button appears here.
        </div>
      ) : !connection ? (
        <div className="hint">
          <strong>Ready to connect.</strong> You will be sent to Google to allow read-only access
          for this app. The access key is stored encrypted, like everything in your vault.
          <br />
          <a className="button-secondary" href="/api/google/connect">
            Connect my Gmail
          </a>
        </div>
      ) : (
        <>
          <div className="hint">
            Connected to <strong>{connection.email}</strong> (read-only).{" "}
            <form action={scanInboxAction} className="inline">
              <button type="submit">Scan my inbox</button>
            </form>{" "}
            {oneClickPending.length > 0 ? (
              <form action={unsubscribeAllAction} className="inline">
                <button type="submit">
                  Unsubscribe from all {oneClickPending.length} one-click senders
                </button>
              </form>
            ) : null}{" "}
            <form action={disconnectGmailAction} className="inline">
              <button type="submit">Disconnect</button>
            </form>
          </div>

          {senders.length === 0 ? (
            <p>No senders found yet — press “Scan my inbox”.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Emails</th>
                  <th>How to unsubscribe</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {senders.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.name ?? row.address}
                      <br />
                      <span className="muted">{row.address}</span>
                    </td>
                    <td>{row.messageCount}</td>
                    <td>
                      {row.oneClick ? (
                        <span className="badge badge-good">one click</span>
                      ) : row.unsubscribeMailtoEncrypted ? (
                        <span className="badge badge-warn">by email</span>
                      ) : (
                        <span className="badge">via their website</span>
                      )}
                    </td>
                    <td>
                      {row.status === "new" ? (
                        <span className="badge">in your inbox</span>
                      ) : row.status === "unsubscribed" ? (
                        <span className="badge badge-good">unsubscribed</span>
                      ) : (
                        <span className="badge">keeping it</span>
                      )}
                    </td>
                    <td>
                      <SenderActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  )
}
