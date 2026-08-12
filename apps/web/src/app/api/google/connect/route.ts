import { googleAuthUrl } from "@/inbox/gmail"

/**
 * Sends the operator to Google's consent screen. Behind the session gate —
 * only the signed-in operator can start a connection.
 */
export function GET(req: Request): Response {
  const origin = new URL(req.url).origin
  return Response.redirect(googleAuthUrl(`${origin}/api/google/callback`), 302)
}
