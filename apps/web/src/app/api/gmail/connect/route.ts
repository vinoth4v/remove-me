import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { buildAuthUrl, OAUTH_STATE_COOKIE } from "@/gmail/oauth.ts"

/**
 * "Connect Gmail" on the Exposure screen. Reachable only with a session —
 * this route isn't in proxy.ts's exemption list, so the operator gate
 * already covers it.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  const state = randomUUID()

  let authUrl: string
  try {
    authUrl = buildAuthUrl(origin, state)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth is not configured"
    return NextResponse.redirect(new URL(`/?gmail_error=${encodeURIComponent(message)}`, origin))
  }

  const jar = await cookies()
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  return NextResponse.redirect(authUrl)
}
