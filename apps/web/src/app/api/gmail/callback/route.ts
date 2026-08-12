import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { completeConnection, OAUTH_STATE_COOKIE } from "@/gmail/oauth.ts"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  const jar = await cookies()
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value
  jar.delete(OAUTH_STATE_COOKIE)

  if (oauthError) {
    return NextResponse.redirect(new URL(`/?gmail_error=${encodeURIComponent(oauthError)}`, url.origin))
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?gmail_error=invalid_state", url.origin))
  }

  try {
    await completeConnection(url.origin, code)
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    return NextResponse.redirect(new URL(`/?gmail_error=${encodeURIComponent(message)}`, url.origin))
  }

  return NextResponse.redirect(new URL("/", url.origin))
}
