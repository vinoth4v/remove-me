import { db } from "@/db/client"
import { auditLog } from "@/db/schema"

export type AuditKind =
  | "sign_in"
  | "sign_in_failed"
  // Vault events carry kind/label only — never an identifier value.
  | "identifier_added"
  | "identifier_removed"
  | "request_created"
  | "request_sent"
  | "reply_logged"
  | "request_resolved"
  | "registry_action"
  | "cron_verify"
  // Inbox events carry the sender/account address only — never tokens or
  // unsubscribe targets.
  | "gmail_connected"
  | "inbox_scanned"
  | "sender_unsubscribed"

/**
 * Write an audit row, swallowing failures.
 *
 * Auditing is observability, not correctness: an unreachable database must
 * never be able to lock the only operator out of their own app.
 */
export async function recordEvent(
  kind: AuditKind,
  actor: string | null,
  detail?: string,
): Promise<void> {
  try {
    await db()
      .insert(auditLog)
      .values({ kind, actor, detail: detail ?? null })
  } catch (error) {
    console.error(`audit_log write failed for "${kind}"`, error)
  }
}
