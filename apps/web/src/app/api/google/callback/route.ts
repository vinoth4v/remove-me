import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { gmailConnection } from "@/db/schema"
import { exchangeCode, profileEmail } from "@/inbox/gmail"
import { encryptIdentifier } from "@/vault/crypto"

/**
 * Google redirects here after consent. The refresh token grants read access
 * to the whole mailbox, so it is encrypted like a vault value before it
 * touches the database. Single operator → at most one connection row.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  if (!code) return Response.redirect(`${url.origin}/inbox?error=denied`, 302)

  try {
    const { refreshToken, accessToken } = await exchangeCode(
      code,
      `${url.origin}/api/google/callback`,
    )
    const email = await profileEmail(accessToken)
    await db().delete(gmailConnection)
    await db()
      .insert(gmailConnection)
      .values({
        email,
        refreshTokenEncrypted: encryptIdentifier(refreshToken),
      })
    await recordEvent("gmail_connected", null, email)
  } catch {
    // The cause may contain OAuth material — never surface or log it.
    return Response.redirect(`${url.origin}/inbox?error=connect_failed`, 302)
  }
  return Response.redirect(`${url.origin}/inbox`, 302)
}
