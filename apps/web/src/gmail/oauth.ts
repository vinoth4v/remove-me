import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db/client"
import { gmailAccount } from "@/db/schema"
import { env } from "@/env"

/**
 * The only Gmail OAuth scope this app ever requests. Read-only, on purpose —
 * the unsubscribe engine sends its own POSTs directly to a sender's own
 * unsubscribe endpoint, never through the Gmail API, so nothing here ever
 * needs a write or send scope. See AGENTS.md.
 */
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

/** CSRF-state cookie name shared by the connect and callback routes. */
export const OAUTH_STATE_COOKIE = "gmail_oauth_state"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"

function redirectUri(origin: string): string {
  return `${origin}/api/gmail/callback`
}

/** Both env vars are optional at the schema level (see env.ts); this is where that is enforced. */
function requireGoogleCredentials(): { clientId: string; clientSecret: string } {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env()
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. See .env.example.",
    )
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
}

/** Where the "Connect Gmail" link on the Exposure screen sends the browser. */
export function buildAuthUrl(origin: string, state: string): string {
  const { clientId } = requireGoogleCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_READONLY_SCOPE,
    access_type: "offline",
    // Forces Google to hand back a refresh_token even if this Google account
    // already granted the same scope before — without it, a reconnect after
    // a revoke would silently get no refresh_token at all.
    prompt: "consent",
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  // Google omits this on a refresh unless the grant changed, so callers that
  // already have one must keep it rather than assume this is always present.
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  scope: z.string().min(1),
  token_type: z.string().min(1),
})

async function requestToken(body: URLSearchParams) {
  const { clientId, clientSecret } = requireGoogleCredentials()
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Google token endpoint answered ${response.status}: ${detail.slice(0, 300)}`)
  }

  return tokenResponseSchema.parse(await response.json())
}

/** Exchanges an authorization code for the first access/refresh token pair. */
async function exchangeCode(origin: string, code: string) {
  return requestToken(
    new URLSearchParams({
      code,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  )
}

async function refreshAccessToken(refreshToken: string) {
  return requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  )
}

/** Reads the connected Gmail address via the profile endpoint gmail.readonly already covers. */
async function fetchProfileEmail(accessToken: string): Promise<string> {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail profile lookup answered ${response.status}`)
  }
  const body = (await response.json()) as { emailAddress?: string }
  if (!body.emailAddress) throw new Error("Gmail profile response had no emailAddress")
  return body.emailAddress
}

/**
 * Completes the "Connect Gmail" flow: exchanges the code, reads which
 * address was granted, and stores the single operator row. Called once, from
 * the OAuth callback route.
 */
export async function completeConnection(origin: string, code: string): Promise<void> {
  const token = await exchangeCode(origin, code)
  const emailAddress = await fetchProfileEmail(token.access_token)

  await db()
    .insert(gmailAccount)
    .values({
      id: "operator",
      emailAddress,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scope: token.scope,
    })
    .onConflictDoUpdate({
      target: gmailAccount.id,
      set: {
        emailAddress,
        accessToken: token.access_token,
        // A reconnect always carries prompt=consent, so refresh_token should
        // always be present — but never overwrite a working one with empty.
        ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope,
        connectedAt: new Date(),
        scanCursor: null,
        scanTotalFetched: 0,
        scanStartedAt: null,
        scanCompletedAt: null,
        lastScanError: null,
      },
    })
}

/** The single operator row, or null when "Connect Gmail" has never completed. */
export async function getGmailAccount() {
  const [account] = await db().select().from(gmailAccount).limit(1)
  return account ?? null
}

/** Renews the stored access token when it is at or near expiry. */
export async function getValidAccessToken(): Promise<string> {
  const account = await getGmailAccount()
  if (!account) throw new Error("Gmail is not connected yet")

  const expiresSoon = account.expiresAt.getTime() - Date.now() < 60_000
  if (!expiresSoon) return account.accessToken

  const token = await refreshAccessToken(account.refreshToken)
  await db()
    .update(gmailAccount)
    .set({
      accessToken: token.access_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
    })
    .where(eq(gmailAccount.id, account.id))

  return token.access_token
}
