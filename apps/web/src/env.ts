import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  WERFT_USER_EMAIL: z.email(),
  WERFT_PASSWORD_HASH: z.string().min(1),
  // The Gmail "Connect" flow — a second, narrower OAuth grant on top of the
  // operator's own sign-in, requesting gmail.readonly only. See
  // src/gmail/oauth.ts. Optional here on purpose: env() backs the sign-in
  // gate itself (src/auth.ts), which must keep working even before Google
  // OAuth is configured — src/gmail/oauth.ts checks for these itself and
  // fails only the Gmail-specific routes when they're missing.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Optional: the Breaches screen renders a clear empty state without one
  // rather than failing, since a paid HIBP key is not something every
  // deployment of this app will have.
  HIBP_API_KEY: z.string().min(1).optional(),
  // Optional: when set, Vercel Cron sends it as a bearer token automatically
  // (Project Settings -> Cron Jobs), and /api/cron/scan checks it. Absent
  // means the endpoint is not callable at all — see that route.
  CRON_SECRET: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

/**
 * Validated environment, resolved on first use.
 *
 * Deliberately lazy: `next build` must not require secrets, so nothing may
 * read the environment at module scope.
 */
export function env(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} (${issue.message})`)
      .join(", ")
    throw new Error(`Invalid environment: ${problems}. See .env.example.`)
  }

  cached = parsed.data
  return cached
}
