import type { GdprStatus, SenderClassification } from "@/db/schema"

type Variant = "neutral" | "muted" | "risk"

/**
 * Bordered text, never a filled colour — the accent (oxblood) only ever
 * shows up here for something the operator should actually worry about:
 * a suspicious sender, an overdue GDPR deadline.
 */
export function Badge({ children, variant = "neutral" }: { children: string; variant?: Variant }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

export function classificationVariant(classification: SenderClassification): Variant {
  if (classification === "suspicious") return "risk"
  if (classification === "legitimate") return "neutral"
  return "muted"
}

export function gdprStatusVariant(status: GdprStatus): Variant {
  if (status === "overdue") return "risk"
  if (status === "responded") return "neutral"
  return "muted"
}
