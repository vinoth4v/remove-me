# remove-me — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

A single-operator console for getting personal data removed under German law.
It holds the operator's identifiers in an encrypted vault, orchestrates DSGVO
requests against data controllers, tracks a checklist of German opt-out
registries, and re-verifies on a weekly schedule — because controllers miss
deadlines and deleted data comes back.

## Domain model

- **Identifier** — one piece of the operator's identity worth tracking: a name
  or name variant, a phone number, a postal address (current or previous), or
  an email address. The crown jewels; encrypted at rest, never logged.
- **Controller** — a party that holds data: the addressee of requests.
- **Exposure** — a known appearance of identifiers at a controller, with how
  it was discovered and a **removability** rating (the permanence classifier):
  `removable`, `suppressible`, or `permanent`. Discovery is restricted by
  design to three sources: breach APIs the operator holds a key for, Art. 15
  disclosures, and manual findings. The app never crawls, scrapes, or queries
  people-search services.
- **Request** — one DSGVO letter (Art. 15 Auskunft / Art. 16 Berichtigung /
  Art. 17 Löschung / Art. 21 Widerspruch, German or English) against one
  controller, carrying a subset of identifiers. Lifecycle:
  draft → sent → responded → satisfied | refused | overdue. An Art. 15 with a
  logged reply prompts a prefilled Art. 17 follow-up. An overdue request
  carries a complaint draft to the supervisory authority (LfDI
  Baden-Württemberg). Nothing is ever sent by the app.
- **Registry item** — a known German opt-out action: a deep link the operator
  clicks themselves, with covered identifier kinds, a renewal interval, and
  the operator's status. A checklist, never an automation.

## Data model

All introduced by migration `0001_identity_vault.sql`; `0000_audit_log.sql`
is the template's audit table.

- `identifier` — kind (`name|phone|address|email`), label, `value_encrypted`
  (AES-256-GCM via `src/vault/crypto.ts`; format `v1.<iv>.<tag>.<ciphertext>`,
  key from `IDENTITY_ENCRYPTION_KEY`). Plaintext exists only in memory while
  rendering a page or letter for the authenticated operator.
- `controller` — name, contact, notes.
- `exposure` — controller FK, source enum, `identifier_ids` (jsonb array of
  identifier UUIDs — a join table would be ceremony for a single-operator
  prototype), removability enum + required `removability_reason`.
- `request` — controller FK, optional exposure FK, type/language/status enums,
  `identifier_ids` jsonb, generated `body`, `sent_at`, `deadline_at`
  (sent + 1 month, Art. 12(3)), `reply_text`/`reply_at`, `follow_up_of_id`
  (the Art. 15 an Art. 17 was spawned from), `recheck_due` (set by cron six
  months after a confirmed erasure), `escalation_draft`.
- `registry_item` — unique `slug` (idempotent seeding key), name, deep link,
  covers jsonb, `renewal_months` (null = indefinite), status
  (`open|done|renewal_due`), `last_action_at`. Seeded by
  `src/registry/seed.ts` on registry page load with `onConflictDoNothing`,
  so fresh databases (including PR preview branches) self-populate and
  operator edits survive.

## Surfaces

All behind the operator gate except where noted.

- `/` — guided home ("Your plan"): a four-step checklist with completion
  state, plus a plain-language "Needs your attention" list.
- `/vault` — "My details": identifier CRUD (decrypts for display server-side).
- `/exposures` — "Who has my data": one form creates controller + exposure
  together (find-or-create by name — a beginner never meets "controller");
  permanent rows show why no request will be drafted.
- `/requests` — list + new-request form (type, language, identifier
  checkboxes; `?exposure=` prefills). Permanent exposures are excluded from
  the form, and `createRequestAction` refuses them server-side regardless.
- `/requests/[id]` — the letter, workflow buttons (sent / log reply /
  satisfied / refused), the Art. 17 follow-up prompt, the escalation draft.
- `/registry` — "Easy wins": the seeded checklist with deep links and "I did it".
- `GET /api/cron/verify` — exempt from the session gate in `proxy.ts`;
  authenticates via `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends
  it automatically). Marks overdue requests (+ escalation draft), re-check
  flags, and registry renewals. Weekly, Mondays 06:00 UTC (`vercel.json`).

## External services

- Neon Postgres via Drizzle — `DATABASE_URL`.
- Vercel Cron — calls `/api/cron/verify` with `CRON_SECRET`.
- `IDENTITY_ENCRYPTION_KEY` — vault key; not a service, but losing it loses
  the vault. Read lazily by `src/vault/crypto.ts` only.
- No model calls in any feature; `src/kompass.ts` sits unused from the
  template.

## Decisions in force

- **Plain language first, law second.** Every label leads with everyday
  words; the DSGVO article stays as small print and in the letters. All
  user-facing wording for the request domain lives in
  `src/requests/labels.ts` so tone stays consistent.

- **No discovery automation, ever.** Crawling, scraping and people-search
  APIs are explicitly forbidden by the operator's spec; the source enum and
  the absence of any fetch-based discovery code are the enforcement.
- **Permanence is a hard server-side gate.** An exposure under an Art. 17(3)
  exemption (legal retention, public register such as Handelsregister or
  Impressum, journalistic archive, public interest) never gets a request —
  the UI explains instead of offering, and the action refuses regardless of
  what was submitted. Requests against such controllers would be legitimately
  refused and just burn the operator's credibility.
- **Vault encryption is app-level, not column-level Postgres.** AES-256-GCM
  in `src/vault/crypto.ts` keeps the key out of the database entirely (Neon
  holds only ciphertext) and works identically on preview branches.
- **One month deadline for all four request types** (Art. 12(3) DSGVO covers
  Art. 15–22); the Art. 21 letter additionally states immediate effect with
  no balancing test, which is about the objection's substance, not the
  response deadline.
- **The app drafts, the operator sends.** Applies to requests and to the
  Art. 77 complaint alike. Keeps the app out of e-mail deliverability,
  authenticity questions, and the blast radius of a bug that mails people.
- **Seeding in app code, not a migration.** Migrations are generated files
  here; hand-editing one to add INSERTs is forbidden by AGENTS.md, and
  idempotent seeding also heals preview branches for free.

## Known gaps

- No breach API integration yet — needs a key the operator holds and a
  dependency decision (raise, don't implement quietly). Until then the
  `breach_api` source is selectable but fed manually.
- Request letters are regenerated only at creation; editing the identifier
  set of an existing draft means creating a new draft.
- The cron marks overdue only for `sent` requests; a `responded` request that
  stalls forever is not flagged — the operator sees it on the list.
- No pagination anywhere — correct for one operator's volumes.
- E2e coverage is the template's gate smoke only; the new surfaces are
  covered by unit tests (crypto, templates, lifecycle) and the typechecker.
