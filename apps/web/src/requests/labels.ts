import type { RequestType } from "@/db/schema"

/** UI display names for the four request types, shared across pages. */
export const typeNames: Record<RequestType, string> = {
  art15: "Art. 15 — Auskunft",
  art17: "Art. 17 — Löschung",
  art21: "Art. 21 — Widerspruch",
  art16: "Art. 16 — Berichtigung",
}
