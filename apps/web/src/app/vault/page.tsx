import { asc } from "drizzle-orm"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { identifier, identifierKinds } from "@/db/schema"
import { decryptIdentifier } from "@/vault/crypto"
import { addIdentifierAction, deleteIdentifierAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const kindNames = {
  name: "Name / name variant",
  phone: "Phone number",
  address: "Postal address",
  email: "Email address",
} as const

export default async function VaultPage() {
  const rows = await db()
    .select()
    .from(identifier)
    .orderBy(asc(identifier.kind), asc(identifier.createdAt))

  const decrypted = rows.map((row) => {
    try {
      return { ...row, value: decryptIdentifier(row.valueEncrypted) }
    } catch {
      return { ...row, value: "‹cannot decrypt — key changed?›" }
    }
  })

  return (
    <main>
      <AppNav current="/vault" />
      <h1>Identity vault</h1>
      <p className="muted">
        The identifiers this app tracks for you — names and variants, phone numbers, postal
        addresses (including previous ones), and additional email addresses. Every value is
        encrypted at rest with IDENTITY_ENCRYPTION_KEY and never appears in logs.
      </p>

      {decrypted.length === 0 ? (
        <p>No identifiers yet. Add the ones you want tracked.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Label</th>
              <th>Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {decrypted.map((row) => (
              <tr key={row.id}>
                <td>{kindNames[row.kind]}</td>
                <td>{row.label}</td>
                <td>{row.value}</td>
                <td>
                  <form action={deleteIdentifierAction} className="inline">
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={addIdentifierAction}>
        <fieldset>
          <legend>Add identifier</legend>
          <p>
            <label htmlFor="kind">Type</label>
            <br />
            <select id="kind" name="kind" required>
              {identifierKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kindNames[kind]}
                </option>
              ))}
            </select>
          </p>
          <p>
            <label htmlFor="label">Label</label>
            <br />
            <input
              id="label"
              name="label"
              required
              placeholder="e.g. maiden name, mobile, previous address"
            />
          </p>
          <p>
            <label htmlFor="value">Value</label>
            <br />
            <input id="value" name="value" required placeholder="the identifier itself" />
          </p>
          <button type="submit">Add to vault</button>
        </fieldset>
      </form>
    </main>
  )
}
