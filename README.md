# Remove Me

Remove Me — a personal exposure console that inventories where my email is leaking, one-click unsubscribes legitimate bulk senders, and drafts trackable GDPR erasure requests for the rest.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.

## What it does

Connect your Gmail account (read-only) and Remove Me scans your last 5,000
messages for bulk senders, clusters them by domain, and tells you which ones
are safe to unsubscribe from automatically and which ones you should just
block. It checks your address against Have I Been Pwned, and drafts
copy-ready GDPR erasure / objection emails you send yourself.

Four screens: **Exposure** (the dashboard), **Senders** (the table, with
Unsubscribe/Block actions), **Breaches**, **Requests** (the GDPR generator and
tracker).

## What works, and what does not

**Works:**
- Google OAuth ("Connect Gmail" on the Exposure screen), `gmail.readonly` only
- A resumable, capped (5,000 message) scan that clusters senders by domain and
  classifies each `legitimate` / `suspicious` / `unknown`
- RFC 8058 One-Click unsubscribe for `legitimate` senders, with every attempt
  logged; a manual link or `mailto:` surface for anything that isn't One-Click;
  a Block action (writes a local blocklist row, never contacts the sender) for
  `suspicious`/`unknown` senders
- HIBP breach lookup, cached 7 days, with a real empty state when
  `HIBP_API_KEY` is unset
- GDPR Art. 17 / Art. 21 email generation in German and English, with a
  draft/sent/responded/overdue tracker and a 30-day countdown
- A daily Vercel Cron job that continues an in-progress scan, refreshes the
  breach cache, and marks overdue requests

**Does not:**
- Send anything. The app has no Gmail write/send scope, ever — see AGENTS.md.
  GDPR emails are generated as text; you send them yourself.
- Discover or opt out of data brokers, scrape the web, or automate anything on
  a third-party site.
- Support more than one user or more than one connected Google account.

**Not yet verified end to end.** This build was assembled without a live
Google Cloud project, Neon database, or HIBP key available to test against —
see `docs/SESSIONS.md` for exactly what that means and what to check first.

## Run it

```bash
pnpm install
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into.

Beyond the template's own `DATABASE_URL`/`AUTH_SECRET`/`WERFT_USER_EMAIL`/
`WERFT_PASSWORD_HASH`, this app also needs `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` (Google Cloud Console, redirect URI
`<your URL>/api/gmail/callback`) for the "Connect Gmail" flow. `HIBP_API_KEY`
and `CRON_SECRET` are optional — see `.env.example` for what each does without
them set.

## Change it

Say what you want in the app's page on the
[marketplace](https://werft-marketplace.vercel.app), or comment `@claude` on an
issue here. Either way Claude works on a branch and opens a pull request; five
gates run against a real preview on its own database branch, and a human
merges. Nothing reaches production on its own.

## Deployment

Merging to `main` deploys. Migrations are applied to production during that
build, before it starts — a failed migration fails the build and the previous
deployment keeps serving.
