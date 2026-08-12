CREATE TABLE "gmail_account" (
	"id" text PRIMARY KEY DEFAULT 'operator' NOT NULL,
	"email_address" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scan_cursor" text,
	"scan_total_fetched" integer DEFAULT 0 NOT NULL,
	"scan_started_at" timestamp with time zone,
	"scan_completed_at" timestamp with time zone,
	"last_scan_error" text
);
--> statement-breakpoint
CREATE TABLE "senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"sample_address" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"has_list_unsubscribe" boolean DEFAULT false NOT NULL,
	"one_click_supported" boolean DEFAULT false NOT NULL,
	"unsubscribe_url" text,
	"unsubscribe_mailto" text,
	"auth_aligned" boolean DEFAULT false NOT NULL,
	"classification" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "senders_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "unsubscribe_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"method" text NOT NULL,
	"http_status" integer,
	"detail" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocklist_sender_id_unique" UNIQUE("sender_id")
);
--> statement-breakpoint
CREATE TABLE "breach_cache" (
	"id" text PRIMARY KEY DEFAULT 'operator' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid,
	"controller_name" text NOT NULL,
	"article" text NOT NULL,
	"language" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"response_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unsubscribe_attempts" ADD CONSTRAINT "unsubscribe_attempts_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "senders_classification_idx" ON "senders" USING btree ("classification");
--> statement-breakpoint
CREATE INDEX "senders_status_idx" ON "senders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "unsubscribe_attempts_sender_idx" ON "unsubscribe_attempts" USING btree ("sender_id");
--> statement-breakpoint
CREATE INDEX "unsubscribe_attempts_at_idx" ON "unsubscribe_attempts" USING btree ("at");
--> statement-breakpoint
CREATE INDEX "gdpr_requests_status_idx" ON "gdpr_requests" USING btree ("status");
--> statement-breakpoint
-- Row-level security, enabled from the start on every table including the
-- template's own audit_log. This app has exactly one Postgres role — the one
-- in DATABASE_URL, which also owns these tables — so RLS is defence in depth
-- rather than the multi-role enforcement it provides in a client-direct
-- (Supabase-style) setup: FORCE is what makes it apply to the owning role at
-- all, and the single permissive policy keeps the app working exactly as
-- before. See docs/ARCHITECTURE.md.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "audit_log" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "gmail_account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gmail_account" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "gmail_account" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "senders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "senders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "senders" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "unsubscribe_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "unsubscribe_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "unsubscribe_attempts" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "blocklist" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "blocklist" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "blocklist" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "breach_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "breach_cache" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "breach_cache" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "gdpr_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gdpr_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "operator_full_access" ON "gdpr_requests" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
