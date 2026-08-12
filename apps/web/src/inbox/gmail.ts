/**
 * Minimal Gmail OAuth + REST client, plain fetch — the blessed-dependency
 * list stays untouched. Scope is deliberately gmail.readonly: the app scans
 * for List-Unsubscribe headers and never sends or modifies mail.
 *
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are read lazily (kompass.ts
 * pattern) so builds and every other feature work without them; the inbox
 * page explains setup when they are missing.
 */

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function clientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID
  if (!value) throw new Error("GOOGLE_CLIENT_ID is not set. See .env.example.")
  return value
}

function clientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET
  if (!value) throw new Error("GOOGLE_CLIENT_SECRET is not set. See .env.example.")
  return value
}

export function googleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function tokenRequest(body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!response.ok) {
    // Deliberately status-only: Google error bodies can echo request fields.
    throw new Error(`Google token endpoint answered ${response.status}`)
  }
  return (await response.json()) as Record<string, unknown>
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ refreshToken: string; accessToken: string }> {
  const data = await tokenRequest(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  )
  const refreshToken = data.refresh_token
  const accessToken = data.access_token
  if (typeof refreshToken !== "string" || typeof accessToken !== "string") {
    throw new Error("Google did not return the expected tokens — reconnect and try again")
  }
  return { refreshToken, accessToken }
}

export async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const data = await tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  )
  if (typeof data.access_token !== "string") {
    throw new Error("Google refresh failed — reconnect the Gmail account")
  }
  return data.access_token
}

async function gmailGet(accessToken: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Gmail API answered ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export async function profileEmail(accessToken: string): Promise<string> {
  const data = await gmailGet(accessToken, "profile")
  if (typeof data.emailAddress !== "string") throw new Error("Gmail profile had no address")
  return data.emailAddress
}

/** One page of ids for messages that look like bulk mail. */
export async function listMessageIds(accessToken: string, max: number): Promise<string[]> {
  const params = new URLSearchParams({
    q: "unsubscribe newer_than:1y",
    maxResults: String(max),
  })
  const data = await gmailGet(accessToken, `messages?${params}`)
  const messages = Array.isArray(data.messages) ? data.messages : []
  return messages
    .map((m) => (m && typeof m === "object" ? (m as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string")
}

export type MessageMeta = {
  from: string | null
  listUnsubscribe: string | null
  listUnsubscribePost: string | null
  internalDate: Date | null
}

export async function getMessageMeta(accessToken: string, id: string): Promise<MessageMeta> {
  const params = new URLSearchParams({ format: "metadata" })
  for (const header of ["From", "List-Unsubscribe", "List-Unsubscribe-Post"]) {
    params.append("metadataHeaders", header)
  }
  const data = await gmailGet(accessToken, `messages/${id}?${params}`)

  const payload = (data.payload ?? {}) as { headers?: { name?: string; value?: string }[] }
  const headers = payload.headers ?? []
  const value = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null

  const internalDate =
    typeof data.internalDate === "string" ? new Date(Number(data.internalDate)) : null

  return {
    from: value("From"),
    listUnsubscribe: value("List-Unsubscribe"),
    listUnsubscribePost: value("List-Unsubscribe-Post"),
    internalDate,
  }
}
