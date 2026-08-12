import { z } from "zod"

/**
 * Thin REST wrapper over the Gmail API — deliberately not the `googleapis`
 * package. Every call this app needs is one fetch and a schema, same
 * reasoning as src/kompass.ts skipping the Anthropic SDK.
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

// Only headers the scan ever reads. metadataHeaders is repeated per Gmail's
// query-param convention (?metadataHeaders=A&metadataHeaders=B). Every
// message body and attachment is left unfetched by format=metadata alone.
const METADATA_HEADERS = [
  "From",
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
  "Date",
  "Subject",
  // Not in the brief's own header list for this fetch, but the
  // classification rule cannot be implemented without it — see
  // docs/ARCHITECTURE.md.
  "Authentication-Results",
] as const

const listResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string() })).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
})

export type MessageListPage = { ids: string[]; nextPageToken: string | null }

export async function listMessageIds(
  accessToken: string,
  options: { pageToken?: string; maxResults: number },
): Promise<MessageListPage> {
  const params = new URLSearchParams({ maxResults: String(options.maxResults) })
  if (options.pageToken) params.set("pageToken", options.pageToken)

  const response = await fetch(`${GMAIL_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail messages.list answered ${response.status}`)
  }
  const parsed = listResponseSchema.parse(await response.json())
  return {
    ids: (parsed.messages ?? []).map((message) => message.id),
    nextPageToken: parsed.nextPageToken ?? null,
  }
}

const metadataResponseSchema = z.object({
  id: z.string(),
  internalDate: z.string().optional(),
  payload: z
    .object({
      headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    })
    .optional(),
})

export type MessageMetadata = {
  id: string
  date: Date
  from: string | null
  listUnsubscribe: string | null
  listUnsubscribePost: string | null
  authenticationResults: string | null
}

function findHeader(
  headers: { name: string; value: string }[] | undefined,
  name: string,
): string | null {
  const header = headers?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())
  return header?.value ?? null
}

export async function getMessageMetadata(
  accessToken: string,
  id: string,
): Promise<MessageMetadata> {
  const params = new URLSearchParams({ format: "metadata" })
  for (const header of METADATA_HEADERS) params.append("metadataHeaders", header)

  const response = await fetch(`${GMAIL_BASE}/messages/${id}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail messages.get answered ${response.status} for ${id}`)
  }
  const parsed = metadataResponseSchema.parse(await response.json())
  const headers = parsed.payload?.headers

  return {
    id: parsed.id,
    // internalDate is epoch milliseconds as a string; the Date header is not
    // used because it is sender-supplied and can be wrong or missing.
    date: parsed.internalDate ? new Date(Number(parsed.internalDate)) : new Date(),
    from: findHeader(headers, "From"),
    listUnsubscribe: findHeader(headers, "List-Unsubscribe"),
    listUnsubscribePost: findHeader(headers, "List-Unsubscribe-Post"),
    authenticationResults: findHeader(headers, "Authentication-Results"),
  }
}
