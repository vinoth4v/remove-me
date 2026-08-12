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

export const identifierKinds = ["name", "phone", "address", "email"] as const
export type IdentifierKind = (typeof identifierKinds)[number]

/**
 * The identity vault. `valueEncrypted` is AES-256-GCM ciphertext produced by
 * src/vault/crypto.ts — the value never touches the database in plaintext,
 * and must never appear in a log line or error trace. The label ("maiden
 * name", "mobile") is deliberately the only human-readable part.
 */
export const identifier = pgTable("identifier", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: identifierKinds }).notNull(),
  label: text("label").notNull(),
  valueEncrypted: text("value_encrypted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type IdentifierRow = typeof identifier.$inferSelect

/** A data controller — anyone requests get addressed to. */
export const controller = pgTable("controller", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contact: text("contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ControllerRow = typeof controller.$inferSelect

export const exposureSources = ["breach_api", "art15_disclosure", "manual"] as const
export type ExposureSource = (typeof exposureSources)[number]

export const removabilities = ["removable", "suppressible", "permanent"] as const
export type Removability = (typeof removabilities)[number]

/**
 * A place where vault data is known to appear. Discovery is deliberately
 * limited to the three sources in `exposureSources` — this app never crawls,
 * scrapes, or queries people-search services. `removability` is the
 * permanence classifier; `permanent` rows exist for awareness and are refused
 * by the request engine.
 */
export const exposure = pgTable(
  "exposure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    controllerId: uuid("controller_id")
      .notNull()
      .references(() => controller.id),
    source: text("source", { enum: exposureSources }).notNull(),
    description: text("description"),
    identifierIds: jsonb("identifier_ids").$type<string[]>().notNull().default([]),
    removability: text("removability", { enum: removabilities }).notNull(),
    removabilityReason: text("removability_reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("exposure_controller_idx").on(table.controllerId)],
)

export type ExposureRow = typeof exposure.$inferSelect

export const requestTypes = ["art15", "art17", "art21", "art16"] as const
export type RequestType = (typeof requestTypes)[number]

export const requestLanguages = ["de", "en"] as const
export type RequestLanguage = (typeof requestLanguages)[number]

export const requestStatuses = [
  "draft",
  "sent",
  "responded",
  "satisfied",
  "refused",
  "overdue",
] as const
export type RequestStatus = (typeof requestStatuses)[number]

/**
 * A DSGVO request against one controller. `deadlineAt` is sentAt + 1 month
 * (Art. 12(3)); the weekly cron moves `sent` past that date to `overdue` and
 * fills `escalationDraft` with a complaint to the supervisory authority —
 * draft only, the app never sends anything. `recheckDue` is set on satisfied
 * Art. 17 requests six months after the confirmed erasure, because
 * re-listing after deletion is the norm.
 */
export const request = pgTable(
  "request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    controllerId: uuid("controller_id")
      .notNull()
      .references(() => controller.id),
    exposureId: uuid("exposure_id").references(() => exposure.id),
    type: text("type", { enum: requestTypes }).notNull(),
    language: text("language", { enum: requestLanguages }).notNull(),
    identifierIds: jsonb("identifier_ids").$type<string[]>().notNull().default([]),
    body: text("body").notNull(),
    status: text("status", { enum: requestStatuses }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    replyText: text("reply_text"),
    replyAt: timestamp("reply_at", { withTimezone: true }),
    followUpOfId: uuid("follow_up_of_id"),
    recheckDue: boolean("recheck_due").notNull().default(false),
    escalationDraft: text("escalation_draft"),
  },
  (table) => [
    index("request_controller_idx").on(table.controllerId),
    index("request_status_idx").on(table.status),
  ],
)

export type RequestRow = typeof request.$inferSelect

export const registryStatuses = ["open", "done", "renewal_due"] as const
export type RegistryStatus = (typeof registryStatuses)[number]

/**
 * Known German opt-out actions — a tracked checklist, never automated.
 * Seeded idempotently by src/registry/seed.ts (keyed on slug); the operator
 * clicks the deep link themselves and records the date here.
 * `renewalMonths` null means the entry does not expire.
 */
export const registryItem = pgTable("registry_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  deepLink: text("deep_link").notNull(),
  covers: jsonb("covers").$type<string[]>().notNull().default([]),
  renewalMonths: integer("renewal_months"),
  status: text("status", { enum: registryStatuses }).notNull().default("open"),
  lastActionAt: timestamp("last_action_at", { withTimezone: true }),
  notes: text("notes"),
})

export type RegistryItemRow = typeof registryItem.$inferSelect
