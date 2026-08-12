# Remove Me

A personal data-removal console for one operator under German law: an encrypted
identity vault, a DSGVO request orchestrator (Auskunft, Löschung, Widerspruch,
Berichtigung — German and English), a seeded checklist of German opt-out
actions, and a weekly sweep that flags overdue requests, due renewals, and
erasures old enough to have quietly come back.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.

## What it does

- **Vault** (`/vault`): store the identifiers you want tracked — names and
  variants, phone numbers, postal addresses (including previous ones), extra
  email addresses. Every value is encrypted at rest (AES-256-GCM, key from
  `IDENTITY_ENCRYPTION_KEY`) and never appears in logs or error traces.
- **Exposures** (`/exposures`): record where your data appears and who
  controls it. Every exposure carries a removability rating with its reason:
  *removable*, *suppressible* (delist from search only), or *permanent*
  (an Art. 17(3) exemption applies — recorded for awareness, and the app
  refuses to draft erasure requests against it).
- **Requests** (`/requests`): generate Art. 15 / 16 / 17 / 21 DSGVO letters in
  German or English against any subset of vault identifiers. Track each one
  draft → sent → responded → satisfied / refused / overdue, with the
  controller's reply text and date stored. Logging an Art. 15 reply prompts a
  prefilled Art. 17 follow-up against the same controller. Overdue requests
  get a complaint draft to LfDI Baden-Württemberg — draft only, the app never
  sends anything.
- **Registry** (`/registry`): six seeded German opt-out actions
  (DDV-Robinsonliste, I.D.I. Robinsonliste, Google "Suchergebnisse über dich",
  Google URL removal, Das Telefonbuch / Das Örtliche deletion, Schufa
  Datenkopie) with deep links, covered identifiers, and renewal intervals.
  Tracked checklist, deliberately not automated — you click, the app remembers.
- **Weekly verification** (Vercel Cron, Mondays): flags requests past the
  one-month Art. 12(3) deadline, registry rows past their renewal interval,
  and erasures confirmed more than six months ago for re-check.

## What works, and what does not

Works today: everything above, behind the single-operator gate.

Does not (deliberately): no crawling, scraping, or people-search lookups of
any kind — discovery is limited to breach APIs you hold a key for, Art. 15
disclosures, and findings you enter yourself. No breach API is wired up yet
(that needs a key and a dependency decision). Nothing is ever sent
automatically — every letter and complaint is a draft you send yourself.

## Run it

```bash
pnpm install
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into. `IDENTITY_ENCRYPTION_KEY` encrypts the vault — losing
it makes the vault unreadable, so keep it with your other secrets.

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
