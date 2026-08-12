import { getExposureSummary } from "@/exposure/summary.ts"
import { runScanAction } from "@/gmail/actions.ts"
import { getGmailAccount } from "@/gmail/oauth.ts"
import { SCAN_MESSAGE_CAP } from "@/gmail/scan.ts"

// Reads the database on every request, so nothing here can be prerendered.
export const dynamic = "force-dynamic"

export default async function ExposurePage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_error?: string }>
}) {
  const { gmail_error: gmailError } = await searchParams
  const [account, summary] = await Promise.all([getGmailAccount(), getExposureSummary()])

  return (
    <>
      <h1>Exposure</h1>

      {gmailError ? <p role="alert">Connecting Gmail failed: {gmailError}</p> : null}

      {!account ? (
        <div className="empty-state">
          <p>Connect a Google account, read-only, to scan for bulk senders.</p>
          <p className="fine-print">
            Requests only the gmail.readonly scope. This app can never send or modify mail — see
            AGENTS.md.
          </p>
          <a href="/api/gmail/connect" className="button-link">
            Connect Gmail
          </a>
        </div>
      ) : (
        <p className="fine-print">
          Connected as <strong>{account.emailAddress}</strong>.{" "}
          {account.scanCompletedAt
            ? `Scan complete — ${account.scanTotalFetched} messages read, capped at ${SCAN_MESSAGE_CAP}.`
            : account.scanStartedAt
              ? `Scan in progress — ${account.scanTotalFetched} messages read so far.`
              : "No scan has run yet."}{" "}
          <form action={runScanAction} className="inline">
            <button type="submit">{account.scanCompletedAt ? "Rescan" : "Run scan"}</button>
          </form>
        </p>
      )}

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Senders</span>
          <span className="stat-value num">{summary.totalSenders}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Unsubscribable</span>
          <span className="stat-value num">{summary.unsubscribableCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Breaches</span>
          <span className={summary.breachCount > 0 ? "stat-value num risk" : "stat-value num"}>
            {summary.breachCount}
          </span>
        </div>
      </div>

      <h2>Exposure score</h2>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${summary.score}%` }} />
      </div>
      <p className="score-label">
        <span className="num">{summary.score} / 100</span>
        <span>
          {summary.lastCalculated
            ? `Last calculated ${summary.lastCalculated.toLocaleString("en-GB")}`
            : "Not yet calculated — connect Gmail and run a scan"}
        </span>
      </p>
    </>
  )
}
