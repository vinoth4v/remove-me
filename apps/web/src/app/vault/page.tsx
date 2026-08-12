import { asc } from "drizzle-orm"
import { AppNav } from "@/app/nav"
import { db } from "@/db/client"
import { identifier, identifierKinds } from "@/db/schema"
import { decryptIdentifier } from "@/vault/crypto"
import { addIdentifierAction, deleteIdentifierAction } from "./actions.ts"

export const dynamic = "force-dynamic"

const kindNames = {
  name: "A name I go by",
  phone: "A phone number",
  address: "A postal address (current or old)",
  email: "An email address",
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
      <h1>My details</h1>
      <p className="muted">
        These are the details the app helps you get removed: names (including old or maiden names),
        phone numbers, addresses you have lived at, and email addresses. Add everything you would
        not want a stranger to find.
      </p>
      <p className="hint">
        🔒 Everything here is stored encrypted. Your details never appear in any log, and the app
        never sends them anywhere — they are only used to fill in letters that you send yourself.
      </p>

      {decrypted.length === 0 ? (
        <p>Nothing here yet — add your first detail below. Your name is a good start.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>What it is</th>
              <th>Your note</th>
              <th>The detail</th>
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
          <legend>Add a detail</legend>
          <p>
            <label htmlFor="kind">What kind of detail is it?</label>
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
            <label htmlFor="label">A short note so you recognise it later</label>
            <br />
            <input
              id="label"
              name="label"
              required
              placeholder="e.g. my maiden name, my old flat in Stuttgart, work mobile"
            />
          </p>
          <p>
            <label htmlFor="value">The detail itself</label>
            <br />
            <input id="value" name="value" required placeholder="e.g. Erika Mustermann" />
          </p>
          <button type="submit">Save (encrypted)</button>
        </fieldset>
      </form>
    </main>
  )
}
