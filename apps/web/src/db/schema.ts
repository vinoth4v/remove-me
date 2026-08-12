import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Append-only record of things worth knowing after the fact: sign-ins,
 * failed sign-ins, and whatever the app built on this template adds.
 *
 * A single-operator app has no admin console, so this table is the only
 * place a past event is recoverable from.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull(),
    actor: text("actor"),
    detail: text("detail"),
  },
  (table) => [index("audit_log_at_idx").on(table.at)],
)

export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert

/**
 * The single Google account's OAuth grant and Gmail scan progress.
 *
 * One row, id fixed to "operator" — this app has exactly one Gmail account to
 * connect, so a table keyed any other way would just be a table with one row
 * and an unused key. Scan progress lives here rather than a separate table
 * because the two are never read independently: connecting and scanning are
 * the same feature.
 */
export const gmailAccount = pgTable("gmail_account", {
  id: text("id").primaryKey().default("operator"),
  emailAddress: text("email_address").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  // Gmail's own nextPageToken. Null both before the first scan and once a scan
  // reaches the end of the mailbox or the 5,000-message cap — scanTotalFetched
  // is what tells those two apart.
  scanCursor: text("scan_cursor"),
  scanTotalFetched: integer("scan_total_fetched").notNull().default(0),
  scanStartedAt: timestamp("scan_started_at", { withTimezone: true }),
  scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }),
  lastScanError: text("last_scan_error"),
})

export type GmailAccountRow = typeof gmailAccount.$inferSelect
export type NewGmailAccountRow = typeof gmailAccount.$inferInsert

/** `senders.classification` — see `src/senders/classify.ts` for the rule. */
export const SENDER_CLASSIFICATIONS = ["legitimate", "suspicious", "unknown"] as const
export type SenderClassification = (typeof SENDER_CLASSIFICATIONS)[number]

/** `senders.status` — what the operator has done about this sender. */
export const SENDER_STATUSES = ["active", "unsubscribed", "blocked"] as const
export type SenderStatus = (typeof SENDER_STATUSES)[number]

/**
 * One row per sender *domain* (not per address — `news@` and `offers@` from
 * the same company collapse into one row, which is the point of clustering by
 * domain rather than by the From address).
 */
export const senders = pgTable(
  "senders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull().unique(),
    // The most recently seen From address for this domain, shown in the UI so
    // a domain is recognisable — the domain alone is sometimes not enough.
    sampleAddress: text("sample_address").notNull(),
    messageCount: integer("message_count").notNull().default(0),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
    hasListUnsubscribe: boolean("has_list_unsubscribe").notNull().default(false),
    // List-Unsubscribe-Post: List-Unsubscribe=One-Click, RFC 8058.
    oneClickSupported: boolean("one_click_supported").notNull().default(false),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeMailto: text("unsubscribe_mailto"),
    // DMARC or SPF alignment, read from the most recent Authentication-Results
    // header seen for this domain.
    authAligned: boolean("auth_aligned").notNull().default(false),
    classification: text("classification", { enum: SENDER_CLASSIFICATIONS }).notNull(),
    status: text("status", { enum: SENDER_STATUSES }).notNull().default("active"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("senders_classification_idx").on(table.classification),
    index("senders_status_idx").on(table.status),
  ],
)

export type SenderRow = typeof senders.$inferSelect
export type NewSenderRow = typeof senders.$inferInsert

/** `unsubscribeAttempts.method` — how the attempt was made, or why it wasn't. */
export const UNSUBSCRIBE_METHODS = ["one_click_post", "manual_link", "mailto", "blocked"] as const
export type UnsubscribeMethod = (typeof UNSUBSCRIBE_METHODS)[number]

/**
 * Audit trail for every unsubscribe (and block) action taken against a
 * sender — the log the Unsubscribe engine's safety rules require showing in
 * the UI.
 */
export const unsubscribeAttempts = pgTable(
  "unsubscribe_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => senders.id, { onDelete: "cascade" }),
    method: text("method", { enum: UNSUBSCRIBE_METHODS }).notNull(),
    // Only set for method = one_click_post.
    httpStatus: integer("http_status"),
    detail: text("detail"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("unsubscribe_attempts_sender_idx").on(table.senderId),
    index("unsubscribe_attempts_at_idx").on(table.at),
  ],
)

export type UnsubscribeAttemptRow = typeof unsubscribeAttempts.$inferSelect
export type NewUnsubscribeAttemptRow = typeof unsubscribeAttempts.$inferInsert

/**
 * Senders the operator chose to block instead of unsubscribe from —
 * suspicious and unknown senders never get an unsubscribe link contacted,
 * because doing so confirms the address is live.
 */
export const blocklist = pgTable("blocklist", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => senders.id, { onDelete: "cascade" })
    .unique(),
  reason: text("reason").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
})

export type BlocklistRow = typeof blocklist.$inferSelect
export type NewBlocklistRow = typeof blocklist.$inferInsert

/** The shape this app keeps from a HIBP breach record — everything else is discarded. */
export type BreachRecord = {
  name: string
  title: string
  breachDate: string
  isVerified: boolean
  dataClasses: string[]
}

/**
 * The single cached HIBP `breachedaccount` response, one row, 7-day expiry.
 * There is exactly one email address in this app, so one cached document is
 * the whole cache.
 */
export const breachCache = pgTable("breach_cache", {
  id: text("id").primaryKey().default("operator"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  payload: jsonb("payload").$type<BreachRecord[]>().notNull(),
})

export type BreachCacheRow = typeof breachCache.$inferSelect
export type NewBreachCacheRow = typeof breachCache.$inferInsert

/** `gdprRequests.article` — the two templates the generator supports. */
export const GDPR_ARTICLES = ["art17", "art21"] as const
export type GdprArticle = (typeof GDPR_ARTICLES)[number]

export const GDPR_LANGUAGES = ["de", "en"] as const
export type GdprLanguage = (typeof GDPR_LANGUAGES)[number]

export const GDPR_STATUSES = ["draft", "sent", "responded", "overdue"] as const
export type GdprStatus = (typeof GDPR_STATUSES)[number]

/**
 * A generated GDPR request and its tracked status. The body is stored rather
 * than regenerated on read, so a request's wording never silently changes
 * after it was already sent — sentAt/responseDueAt are what the 30-day
 * countdown reads.
 */
export const gdprRequests = pgTable(
  "gdpr_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Set null (not cascaded) if the sender is later removed: the request and
    // its history are worth keeping even if the sender row is gone.
    senderId: uuid("sender_id").references(() => senders.id, { onDelete: "set null" }),
    controllerName: text("controller_name").notNull(),
    article: text("article", { enum: GDPR_ARTICLES }).notNull(),
    language: text("language", { enum: GDPR_LANGUAGES }).notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: GDPR_STATUSES }).notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    responseDueAt: timestamp("response_due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("gdpr_requests_status_idx").on(table.status)],
)

export type GdprRequestRow = typeof gdprRequests.$inferSelect
export type NewGdprRequestRow = typeof gdprRequests.$inferInsert
