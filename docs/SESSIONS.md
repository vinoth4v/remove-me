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

## Multi-identifier coverage — vault, request engine, registry, cron

**Asked:** check completeness against the "Multi-Identifier Coverage"
addendum and fix what is missing. Nothing existed beyond the scaffold — the
placeholder home page was still live — so this session built the addendum
scope in full: identity vault, four-type DSGVO request engine (DE/EN),
seeded German opt-out registry, permanence classifier, weekly verification
cron, and escalation drafts.

**Changed:** migration `0001_identity_vault.sql` (identifier, controller,
exposure, request, registry_item); `src/vault/crypto.ts` (AES-256-GCM,
`IDENTITY_ENCRYPTION_KEY`); `src/requests/templates.ts` + `lifecycle.ts`
(pure, unit-tested); `src/registry/seed.ts` (six rows, idempotent on slug);
pages `/`, `/vault`, `/exposures`, `/requests`, `/requests/[id]`,
`/registry`; `GET /api/cron/verify` + `vercel.json` weekly cron + proxy
exemption; audit kinds extended (vault events log kind/label, never values).
41 unit tests; build, lint, typecheck, e2e smoke all green.

**Decided:**
- Permanence is enforced server-side in `createRequestAction`, not just
  hidden in the UI — a permanent exposure must be un-requestable however the
  form is submitted.
- Vault key and `CRON_SECRET` are read lazily by their own modules rather
  than added to `env()`'s schema, following the `kompass.ts` precedent, so
  unit tests and builds need neither and errors name the exact missing var.
- Registry seeding lives in app code (`onConflictDoNothing` on `slug`)
  because migrations are generated files here and hand-editing them is
  forbidden; it also seeds PR preview branches for free.
- All four request types share the Art. 12(3) one-month deadline; the
  Art. 21 letter states immediate effect and no balancing test as a matter
  of substance.
- Schufa deep link is `meineschufa.de/datenkopie` — the `schufa.de`
  datenkopie paths 404 (verified, all six seeded links checked reachable).

**Rejected:**
- Any breach-API client, "just stubbed": a dependency and a key decision for
  the operator, not something to implement quietly. Source enum ships;
  integration waits.
- A join table for exposure/request ↔ identifiers: jsonb UUID arrays are
  enough for one operator and keep the queries flat.
- Auto-creating the Art. 17 follow-up when an Art. 15 reply is logged: the
  spec says *prompt*, so the detail page prompts and one click creates the
  prefilled draft.

**Open:** breach API integration (needs key + blessing); e2e coverage for
the new surfaces; whether `responded`-but-stalled requests deserve a cron
flag of their own.

---

## Browser walkthrough of the deployed feature set

**Asked:** log in and try the app; then record the one gotcha found.

**Changed:** no app code. `.env.example` gained a warning that
`WERFT_PASSWORD_HASH` must have every `$` escaped as `\$` in `.env.local`;
this entry.

**What was done:** ran the app locally against a disposable Neon branch
(`local-try-app`, branched from production, deleted afterwards — production
data untouched) with a throwaway operator password, and drove every surface
in a real browser. Verified: the login gate and its audit trail; all four
identifier kinds stored as `v1.<iv>.<tag>.<ciphertext>` with no plaintext in
the database; the permanence classifier showing "Draft request" for a
removable exposure and the Art. 17(3) refusal text for a permanent one; the
prefilled Art. 15 → sent (deadline exactly +1 month) → reply logged →
prefilled Art. 17 follow-up chain; all six registry rows with working links
and "Done today"; the cron rejecting unauthenticated calls, flagging a
backdated request overdue and a backdated registry row renewal-due, and
writing the LfDI Baden-Württemberg complaint draft.

**Found the hard way:** Next's `@next/env` runs dotenv-expansion on
`.env.local` values *even inside single quotes*, so an unescaped scrypt hash
(`scrypt$65536$…`) is silently truncated to the literal string `scrypt` and
every sign-in fails with no other symptom. The fix is escaping each `$` as
`\$`. Vercel dashboard env vars are stored, not parsed, so production was
never affected — which is why the bug only ever bites local dev.

**Open:** nothing new.

---

## Plain-language UX overhaul

**Asked:** the UI was too complicated for a non-technical person — make it
easy enough that a beginner benefits.

**Changed:** every screen rewritten in plain language; no schema or workflow
changes. Navigation is now Home / My details / Who has my data / My requests
/ Easy wins. Home is a numbered four-step plan with completion ticks and a
"Needs your attention" list of plain sentences. Request types are radio
choices ("Ask what they know about me", "Delete my data", "Stop sending me
advertising", "Correct wrong data") with one-line explanations; the legal
names stay as small print. Statuses read as "waiting for their answer",
"answer overdue", "done". The request detail page tells the user exactly
what to do next per status, with a Copy-the-letter button (first client
component, `src/components/copy-button.tsx`) and an "Open in my email app"
mailto link when the company's address is known. Adding an exposure and its
company is now one form — `addExposureAction` finds-or-creates the
controller case-insensitively, and a skipped "why" gets a stored default
reason per removability rating. All wording lives in
`src/requests/labels.ts`.

**Decided:**
- Plain words lead, legal terms follow in parentheses — the letters still
  cite the articles, so the user learns the mapping without needing it.
- The separate "add controller" step was removed rather than simplified: a
  beginner should never meet the word "controller".
- Radio groups with per-option hints replace selects for request type and
  removability — a select hides exactly the explanations a beginner needs.

**Rejected:** a multi-page wizard with client-side state — more code and
more ways to get lost than one guided page per topic; revisit only if the
single-page forms grow.

**Verified:** in a real browser against a disposable Neon branch
(`local-ux-check`, deleted after): guided home, one-form company+exposure
add, plain-language letter form, and the draft page's copy/email/sent flow.
Found and fixed radios rendering full-width (the `input { width: 100% }`
reset needed a radio carve-out alongside checkboxes).

**Open:** nothing new.
