# remove-me — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

Remove Me — a personal exposure console that inventories where my email is leaking, one-click unsubscribes legitimate bulk senders, and drafts trackable GDPR erasure requests for the rest.

## Domain model

- **Gmail account** — the one connected Google account, read-only. Owns scan
  progress (a resumable cursor and a 5,000-message cap).
- **Sender** — a domain seen sending mail, not an address: `news@` and
  `offers@` from the same company are one sender. Carries a classification
  (`legitimate` / `suspicious` / `unknown`) that gates what the operator is
  offered, and a status (`active` / `unsubscribed` / `blocked`) recording what
  the operator did about it.
- **Unsubscribe attempt** — one row per action taken against a sender: a
  One-Click POST (with its HTTP status) or a block. The audit trail.
- **Blocklist entry** — a sender the operator chose to block instead of
  contact, with the reason recorded.
- **Breach** — a Have I Been Pwned record for the connected address, cached
  as one document for 7 days.
- **GDPR request** — a generated Art. 17 or Art. 21 email, its language, and
  its tracked status through `draft` → `sent` → `responded`/`overdue`.

## Data model

All from migration `0001_gmail_senders_gdpr.sql` (on top of the template's
own `0000_audit_log.sql`):

- **`gmail_account`** — one row, `id = 'operator'`. OAuth tokens
  (`access_token`, `refresh_token`, `expires_at`, `scope`), plus scan progress
  (`scan_cursor`, `scan_total_fetched`, `scan_started_at`, `scan_completed_at`,
  `last_scan_error`). Connecting and scanning share a table because they are
  never read independently.
- **`senders`** — one row per domain (`domain` unique). Aggregated fields
  (`message_count`, `first_seen`, `last_seen`) plus the most recent message's
  header-derived fields (`has_list_unsubscribe`, `one_click_supported`,
  `unsubscribe_url`, `unsubscribe_mailto`, `auth_aligned`), `classification`,
  and `status`.
- **`unsubscribe_attempts`** — `sender_id` (cascade), `method`
  (`one_click_post` / `manual_link` / `mailto` / `blocked`), `http_status`,
  `detail`, `at`. Manual-link and mailto surfaces are rendered but never
  logged here — the app makes no request for either, so there is no attempt
  to record, only the sender's own `unsubscribe_url`/`unsubscribe_mailto`.
- **`blocklist`** — `sender_id` (unique, cascade), `reason`, `at`.
- **`breach_cache`** — one row, `id = 'operator'`, `payload` (the HIBP
  response, reshaped to `{name, title, breachDate, isVerified, dataClasses}`
  per entry), `fetched_at`, `expires_at`.
- **`gdpr_requests`** — `sender_id` (nullable, set-null on delete —
  a request outlives the sender row it was about), `controller_name`,
  `article` (`art17`/`art21`), `language` (`de`/`en`), `body` (rendered once
  and stored, so wording never changes after generation), `status`
  (`draft`/`sent`/`responded`/`overdue`), `sent_at`, `response_due_at`
  (`sent_at` + 30 days), `created_at`.

**Row-level security.** Every table above, plus the template's own
`audit_log`, gets `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and
one permissive `USING (true) WITH CHECK (true)` policy, in the same migration.
This app has exactly one Postgres role — the one in `DATABASE_URL`, which also
owns every table — so there is no second, more-restricted role for RLS to
actually constrain the way it would in a client-direct (Supabase-style)
setup. `FORCE` is what makes the policy apply to the owning role at all;
without it, an owner bypasses RLS regardless of what policies exist, and
`ENABLE` alone would be cosmetic. This is RLS as defence in depth against a
future second credential, not RLS as the access-control layer — see
"Decisions in force" below.

**Migration snapshot caveat.** `db:generate`/`db:migrate` need `pnpm`, which
was not runnable in the sandbox this migration was authored in (see
SESSIONS.md). `0001_gmail_senders_gdpr.sql` and its
`meta/0001_snapshot.json` were hand-written to match what `drizzle-kit
generate` would produce from `schema.ts`. Run `pnpm db:generate` once
dependencies install for real; it should report no pending changes. If it
doesn't, `schema.ts` is the source of truth — regenerate the migration from
it rather than hand-editing the snapshot again.

## Surfaces

Everything below sits behind the operator's session (the template's
Credentials gate) except the two marked otherwise. Connecting Gmail is a
second, narrower grant on top of that session — it does not change who can
sign in.

- `/` — Exposure: total senders, unsubscribable count, breach count, exposure
  score, Connect Gmail / run-scan controls.
- `/senders` — the sender table, per-row Unsubscribe/Block, bulk "unsubscribe
  from all eligible", the unsubscribe/block audit log.
- `/breaches` — HIBP results or the appropriate empty state.
- `/requests` — the GDPR generator form and tracker.
- `/api/gmail/connect`, `/api/gmail/callback` — the "Connect Gmail" OAuth
  round trip. Session-gated like every other route; state carried in a
  short-lived signed-nothing httpOnly cookie (`gmail_oauth_state`), checked
  on return.
- `/api/cron/scan` — **not** session-gated (Vercel Cron has no session
  cookie); gated instead by `CRON_SECRET`, which Vercel sends as a bearer
  token automatically when the project env var is set. Absent `CRON_SECRET`
  means the route always refuses. Continues any in-progress scan, refreshes
  the breach cache if stale, marks overdue GDPR requests. The one Vercel Cron
  entry (`apps/web/vercel.json`), daily — Hobby's own limit.
- Server actions (no dedicated routes): `runScanAction` (manual "Run scan" /
  "Rescan"), `unsubscribeAction`, `blockAction`, `runBulkUnsubscribeAction`,
  `createGdprRequestAction`, `markSentAction`, `markRespondedAction`.

## External services

- **Neon Postgres**, via `DATABASE_URL` — all storage, RLS as above.
- **Google OAuth / Gmail API** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  REST calls only (`src/gmail/client.ts`, `src/gmail/oauth.ts`), no
  `googleapis` package. `gmail.readonly` is the only scope ever requested.
  Optional at the `env.ts` schema level even though the build brief called
  them required: `env()` also backs the operator's own Credentials sign-in
  (`src/auth.ts`), and a single all-or-nothing schema would otherwise fail
  every sign-in on a deployment that has not configured Google OAuth yet —
  `src/gmail/oauth.ts` checks for both itself and fails only the Gmail
  routes when they are missing, the same shape as `HIBP_API_KEY` below.
- **Have I Been Pwned** — `HIBP_API_KEY`, optional. `src/hibp/client.ts`
  no-ops to an explanatory empty state without it; cached 7 days when present.
- **Vercel Cron** — `CRON_SECRET`, optional; the cron route always 404s
  without it, so an operator who never sets it up simply never has a
  reachable cron endpoint, with no other effect on the app.

## Decisions in force

- **Neon + Drizzle + NextAuth instead of Supabase.** The build brief's own
  Stack section named Supabase Postgres and "Supabase Auth or Auth.js" — but
  this repo (see `AGENTS.md`, `werft.json`) is already scaffolded on
  Neon/Drizzle/NextAuth, and `AGENTS.md`'s blessed-dependency list does not
  include a Supabase client. The brief's own "or Auth.js" already permits
  this for auth; for storage, adding Supabase would mean two competing
  database/auth systems in one app for no benefit the existing one doesn't
  already provide. See the RLS note above for what that substitution costs.
- **No Tailwind.** The brief's Stack section named Tailwind; the template has
  no Tailwind and instead generates CSS custom properties from
  `@werft/tokens`, with `AGENTS.md` explicitly forbidding raw colour/
  spacing/font literals in a stylesheet. The print-editorial look
  (`packages/tokens/src/themes.ts`, theme `editorial`) is built as a token
  theme instead — same visual result, no new dependency, no rule bent.
- **Gmail connection is separate from the sign-in gate.** NextAuth's
  Credentials provider (email + password hash) is still the only way to sign
  in — `AGENTS.md` forbids a second user, and making Google an alternative
  sign-in provider would be exactly that (anyone with the right Google
  account could sign in). "Connect Gmail" instead is a same-session action
  that stores a Gmail API token, independent of identity.
- **Authentication-Results is fetched even though the brief's own metadata
  header list omits it.** The brief specifies the classification rule
  needs DMARC/SPF alignment "as reported in the Authentication-Results
  header", but the header list for the scan's metadata fetch (From,
  List-Unsubscribe, List-Unsubscribe-Post, Date, Subject) does not include
  it — the rule is unimplementable without it. Resolved by fetching it too;
  still `format=metadata`, still no body or attachment.
- **Header-derived sender fields take the newest message's values, not an
  OR/AND across all of them.** Gmail lists newest-first, so within one scan
  the first occurrence of a domain is its most recent message; the scan uses
  that message's `List-Unsubscribe`/auth fields and only `messageCount`
  keeps accumulating from older ones. A sender who fixed (or broke) its
  unsubscribe header is judged on what it does today.
- **The exposure score is computed live, not stored.** Nothing in the brief
  asks for a score history; computing it from current `senders`/
  `breach_cache` state on every read means it can never disagree with what
  the Senders/Breaches screens show. "Last calculated" is the more recent of
  the last scan completion and the last breach fetch.
- **Manual-link and mailto surfaces are not written to the audit log.** The
  brief's "every attempt writes an audit row" describes what this app itself
  does; opening a link or composing a mailto in another window is the
  operator's own action, outside anything the app can observe or verify, so
  logging it would be a fabricated row.

## Known gaps

- **Not exercised against a live Google account, Neon database, or HIBP key.**
  This build was assembled in a sandbox with `pnpm` unavailable and no real
  credentials — see SESSIONS.md. Google OAuth, a real Gmail scan, a real
  One-Click POST, and a real HIBP lookup are all written to spec and covered
  by unit tests for the pure logic (header parsing, classification,
  unsubscribe method selection, GDPR templating) but not run end to end.
  Before trusting this in production: connect a real Google account, run a
  scan, and confirm `pnpm db:generate` reports no drift from the hand-written
  migration.
- **No settings screen for a stuck or failed scan.** `last_scan_error` is
  written but not yet surfaced in the UI — a failed scan currently only shows
  as "no scan has run yet" / stale progress rather than naming what broke.
- **The GDPR tracker has no reminder mechanism** beyond the daily cron
  flipping `sent` to `overdue` — nothing emails or otherwise notifies the
  operator when that happens (the app cannot send mail at all, by design).
