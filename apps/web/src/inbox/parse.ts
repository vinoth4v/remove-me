/**
 * Pure parsing for the inbox scan: RFC 2369 List-Unsubscribe headers, RFC
 * 8058 one-click detection, and From-header splitting. No I/O, fully
 * unit-tested — the Gmail client feeds these raw header strings.
 */

export type UnsubscribeMethod = {
  /** https unsubscribe endpoint, if the sender offers one. */
  url: string | null
  /** mailto address (without the scheme), if offered. */
  mailto: string | null
  /** RFC 8058: the https URL accepts an unattended POST. */
  oneClick: boolean
}

/** `<https://x/u?id=1>, <mailto:unsub@x.com>` → both channels, if present. */
export function parseListUnsubscribe(
  header: string | null | undefined,
  postHeader: string | null | undefined,
): UnsubscribeMethod | null {
  if (!header) return null

  let url: string | null = null
  let mailto: string | null = null

  for (const match of header.matchAll(/<([^>]+)>/g)) {
    const target = (match[1] ?? "").trim()
    if (target.toLowerCase().startsWith("mailto:")) {
      mailto ??= target.slice("mailto:".length).split("?")[0] ?? null
    } else if (target.toLowerCase().startsWith("https://")) {
      url ??= target
    }
  }

  if (!url && !mailto) return null

  const oneClick = url !== null && /one-click/i.test(postHeader ?? "")
  return { url, mailto, oneClick }
}

/** `"Acme News" <news@acme.example>` → name and address; bare addresses too. */
export function parseFromHeader(from: string): { name: string | null; address: string } | null {
  const bracketed = from.match(/<([^>]+)>/)
  const address = (bracketed?.[1] ?? from).trim().toLowerCase()
  if (!address.includes("@")) return null

  let name: string | null = null
  if (bracketed) {
    name = from.slice(0, bracketed.index).trim().replace(/^"|"$/g, "").trim() || null
  }
  return { name, address }
}

/**
 * Guard for server-side one-click POSTs: only https, only to public-looking
 * hosts. The URLs come from the operator's own inbox, but the server should
 * still never be talked into calling itself or something on its network.
 */
export function isSafeUnsubscribeUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false
  // Numeric IPv4 and bracketed IPv6 hosts are rejected outright — public
  // unsubscribe endpoints have hostnames.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return false
  return true
}
