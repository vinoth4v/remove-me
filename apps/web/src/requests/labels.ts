import type { Removability, RequestStatus, RequestType } from "@/db/schema"

/**
 * All user-facing wording for the request workflow lives here, in plain
 * language. The legal names (Art. 15 DSGVO …) stay visible as small print —
 * they matter in the letters — but never as the primary label.
 */

export const typeNames: Record<RequestType, string> = {
  art15: "Art. 15 — Auskunft",
  art17: "Art. 17 — Löschung",
  art21: "Art. 21 — Widerspruch",
  art16: "Art. 16 — Berichtigung",
}

export const plainTypeNames: Record<RequestType, string> = {
  art15: "Ask what they know about me",
  art17: "Delete my data",
  art21: "Stop sending me advertising",
  art16: "Correct wrong data",
}

export const typeHints: Record<RequestType, string> = {
  art15:
    "The company must send you a full copy of everything they have about you, and say where they got it. Good first step when you are not sure.",
  art17: "The company must erase your data unless a law forces them to keep it.",
  art21: "Works immediately — they must stop marketing to you, no excuses allowed.",
  art16: "For when a company has your name, address or other details wrong.",
}

export const statusLabels: Record<RequestStatus, string> = {
  draft: "letter ready to send",
  sent: "waiting for their answer",
  responded: "they answered",
  satisfied: "done",
  refused: "they said no",
  overdue: "answer overdue",
}

export const removabilityLabels: Record<Removability, string> = {
  removable: "can be deleted",
  suppressible: "can be hidden from search",
  permanent: "must stay (the law requires it)",
}

/** Fallback reasons stored when the user skips the optional "why" field. */
export const defaultRemovabilityReasons: Record<Removability, string> = {
  removable: "Commercial provider — no legal duty to keep my data.",
  suppressible: "The source cannot delete it, but search engines can stop showing it.",
  permanent:
    "A law requires this record to stay public (e.g. Handelsregister, Impressum, news archive).",
}
