CREATE TABLE "controller" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exposure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" uuid NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"identifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"removability" text NOT NULL,
	"removability_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identifier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"value_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"deep_link" text NOT NULL,
	"covers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"renewal_months" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"last_action_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "registry_item_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" uuid NOT NULL,
	"exposure_id" uuid,
	"type" text NOT NULL,
	"language" text NOT NULL,
	"identifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"reply_text" text,
	"reply_at" timestamp with time zone,
	"follow_up_of_id" uuid,
	"recheck_due" boolean DEFAULT false NOT NULL,
	"escalation_draft" text
);
--> statement-breakpoint
ALTER TABLE "exposure" ADD CONSTRAINT "exposure_controller_id_controller_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controller"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_controller_id_controller_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controller"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_exposure_id_exposure_id_fk" FOREIGN KEY ("exposure_id") REFERENCES "public"."exposure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exposure_controller_idx" ON "exposure" USING btree ("controller_id");--> statement-breakpoint
CREATE INDEX "request_controller_idx" ON "request" USING btree ("controller_id");--> statement-breakpoint
CREATE INDEX "request_status_idx" ON "request" USING btree ("status");