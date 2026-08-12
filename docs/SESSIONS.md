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
