import { getBreaches } from "@/hibp/client.ts"
import { Badge } from "../badge.tsx"

export const dynamic = "force-dynamic"

export default async function BreachesPage() {
  const result = await getBreaches()

  return (
    <>
      <h1>Breaches</h1>

      {result.status === "no_email" ? (
        <div className="empty-state">
          <p>Connect Gmail on the Exposure screen first — breach lookup needs an address to check.</p>
        </div>
      ) : result.status === "no_key" ? (
        <div className="empty-state">
          <p>Breach lookup needs a Have I Been Pwned API key, which is paid.</p>
          <p className="fine-print">
            Set HIBP_API_KEY to enable this screen. Everything else in the app works without it.
          </p>
        </div>
      ) : result.status === "error" ? (
        <p role="alert">Breach lookup failed: {result.message}</p>
      ) : result.breaches.length === 0 ? (
        <div className="empty-state">
          <p>No breaches found for the connected address.</p>
          <p className="fine-print">
            Checked {result.fetchedAt.toLocaleString("en-GB")}
            {result.cached ? " (cached)" : ""}.
          </p>
        </div>
      ) : (
        <>
          <p className="fine-print">
            Checked {result.fetchedAt.toLocaleString("en-GB")}
            {result.cached ? " (cached)" : ""} — cached for 7 days.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Breach</th>
                <th>Date</th>
                <th>Verified</th>
                <th>Data exposed</th>
              </tr>
            </thead>
            <tbody>
              {result.breaches.map((breach) => (
                <tr key={breach.name}>
                  <td>{breach.title}</td>
                  <td className="num">{breach.breachDate.slice(0, 10)}</td>
                  <td>
                    <Badge variant={breach.isVerified ? "risk" : "muted"}>
                      {breach.isVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </td>
                  <td>{breach.dataClasses.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
