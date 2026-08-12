import { db } from "@/db/client"
import { registryItem } from "@/db/schema"

/**
 * The known German opt-out actions this app tracks. A checklist, never an
 * automation: the deep link is for the operator to click, the row records
 * where they stand. Deep links verified reachable 2026-08-12.
 *
 * Seeding is idempotent on `slug` so the registry page can call it on every
 * load — a fresh database (including every PR preview branch) gets the rows,
 * an existing one is untouched, and operator edits survive.
 */
export const seedRows: (typeof registryItem.$inferInsert)[] = [
  {
    slug: "ddv-robinsonliste",
    name: "DDV-Robinsonliste",
    deepLink: "https://www.ich-habe-die-wahl.de/",
    covers: ["name", "address"],
    renewalMonths: 60,
    notes: "Postal advertising opt-out. Free; entry expires after 5 years.",
  },
  {
    slug: "idi-robinsonliste",
    name: "I.D.I. Robinsonliste",
    deepLink: "https://www.robinsonliste.de/",
    covers: ["email", "phone", "name", "address"],
    renewalMonths: null,
    notes: "Email, mobile, landline, fax and postal opt-out. Free; indefinite.",
  },
  {
    slug: "google-results-about-you",
    name: 'Google "Suchergebnisse über dich"',
    deepLink: "https://myactivity.google.com/results-about-you",
    covers: ["name", "phone", "address"],
    renewalMonths: 6,
    notes: "Monitors search results for name/phone/address. Recurring — review the alerts.",
  },
  {
    slug: "google-url-removal",
    name: "Google URL removal (right to be forgotten)",
    deepLink: "https://reportcontent.google.com/forms/rtbf",
    covers: ["name"],
    renewalMonths: null,
    notes: "Per-URL delisting under Art. 17 — file one request per URL as they surface.",
  },
  {
    slug: "telefonbuch-eintrag-loeschen",
    name: "Das Telefonbuch / Das Örtliche entry deletion",
    deepLink: "https://www.dastelefonbuch.de/",
    covers: ["name", "phone", "address"],
    renewalMonths: 12,
    notes:
      "Directory entry deletion; also check dasoertliche.de. Re-check yearly — directories re-import.",
  },
  {
    slug: "schufa-datenkopie",
    name: "Schufa Datenkopie (Art. 15)",
    deepLink: "https://www.meineschufa.de/datenkopie",
    covers: ["name", "address"],
    renewalMonths: 12,
    notes: "Free copy of held data, once per year.",
  },
]

export async function ensureRegistrySeeded(): Promise<void> {
  await db().insert(registryItem).values(seedRows).onConflictDoNothing({
    target: registryItem.slug,
  })
}
