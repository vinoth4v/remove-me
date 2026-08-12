# remove-me — session log

One entry per build session, newest last. Append; never edit an existing
entry, for the same reason migrations are append-only — a corrected record of
what was decided is no longer a record.

Each entry answers: what was asked, what changed, what was decided and why,
what was rejected, and what is still open.

---

## Scaffolded

**Asked:** create the app.

**Changed:** scaffolded from werft-template — App Router, single-operator
auth, Neon via Drizzle, design tokens, the PR gates, and `@claude` wired to
the operator's Claude subscription.

**Decided:** nothing yet beyond the template's own choices, which are in
AGENTS.md.

**Open:** everything the app is actually for. See ARCHITECTURE.md, which is
still a set of empty headings until the first feature lands.

---

## Built the app: Gmail scan, unsubscribe engine, breach lookup, GDPR tracker

**Asked:** the full build plan filed on issue #1 — Google OAuth (gmail.readonly
only) → Gmail scan/sender clustering/classification → RFC 8058 unsubscribe
engine with a Block alternative for suspicious/unknown senders → HIBP breach
lookup → GDPR Art. 17/21 generator and tracker → the four screens, styled as a
print-editorial data console (warm paper, oxblood risk accent).

**Changed:** everything in ARCHITECTURE.md's Data model and Surfaces —
migration `0001_gmail_senders_gdpr.sql` (six new tables, RLS on all of them
plus `audit_log`); `src/gmail/` (OAuth connect/callback, REST client, scan
with a resumable cursor and 5,000-message cap); `src/senders/classify.ts`
(the classification rule, unit tested); `src/unsubscribe/engine.ts` (One-Click
POST, manual/mailto surfaces, Block, the audit log); `src/hibp/client.ts`
(7-day cache, no-key empty state); `src/gdpr/` (DE/EN templates for Art. 17
and Art. 21, the tracker); `apps/web/vercel.json` (the one daily cron entry);
the four screens under `src/app/(app)/`; a new `editorial` theme in
`packages/tokens` (serif headings via a new optional `fontFamily.serif`
token, oxblood accent, zero border-radius).

**Decided:**
- Neon/Drizzle/NextAuth instead of the brief's Supabase, and no Tailwind —
  both explained in ARCHITECTURE.md's Decisions in force, both because
  `AGENTS.md` (which the repo's own instructions say overrides) already
  commits this scaffold to a different stack than the brief's Stack section
  named. The brief's own "Supabase Auth **or Auth.js**" already permits the
  auth half of this; the storage and styling halves are argued in
  ARCHITECTURE.md.
- "Connect Gmail" is a second OAuth grant layered on the existing
  Credentials sign-in, not a new sign-in provider — see ARCHITECTURE.md,
  and `AGENTS.md`'s "never add a second user".
- Fetching `Authentication-Results` even though the brief's own header list
  for the scan omitted it — the classification rule cannot be implemented
  without it. See ARCHITECTURE.md.
- RLS is enabled, forced, and given one permissive policy on every table,
  which is honest defence-in-depth for this app's single-Postgres-role
  reality rather than the multi-role enforcement the brief's Supabase-shaped
  requirement implies — see ARCHITECTURE.md.

**Rejected:**
- Adding the `googleapis` npm package — every Gmail/Google call here is one
  `fetch` and a `zod` schema, matching how `src/kompass.ts` already treats
  the Anthropic SDK as unnecessary.
- Storing the exposure score — computed live instead, so it can't disagree
  with the Senders/Breaches screens it's derived from.
- Logging manual-link/mailto "attempts" — the app never makes that request,
  so there is nothing it actually observed to log.

**Open:**
- **Not run end to end.** The sandbox this was built in had no working
  `pnpm` (present in `pr-checks.yml`'s jobs, absent from `claude.yml`'s — it
  has no `pnpm/action-setup`/`setup-node` step) and Bash was scoped to
  `git`/`pnpm`/`gh`, so `pnpm install`, `typecheck`, `test`, and `build`
  could not be run here even once `pnpm` existed. Everything was written and
  reviewed by hand against the existing codebase's conventions; `pr-checks.yml`
  is the first real gate this goes through. Adding a `pnpm/action-setup` +
  `actions/setup-node` step to `claude.yml` (mirroring `pr-checks.yml`'s) would
  let a future `@claude` run on this repo actually self-verify before opening
  a PR — flagged here rather than done, since editing workflow files is
  outside what this run's own permissions allow.
- The migration's `meta/0001_snapshot.json` was hand-authored to match what
  `drizzle-kit generate` would produce — verify with `pnpm db:generate` once
  installable; see ARCHITECTURE.md's Data model note.
- Real credentials (a Google Cloud OAuth client, a live inbox, an HIBP key)
  are needed to confirm the acceptance criteria that describe live behaviour:
  a real scan populating the Senders table, a real One-Click POST landing an
  audit row with an HTTP status, real Breaches-screen results.
- `last_scan_error` is written on failure but not yet surfaced in the UI —
  see ARCHITECTURE.md's Known gaps.
