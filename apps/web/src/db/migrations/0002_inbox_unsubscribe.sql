CREATE TABLE "bulk_sender" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"name" text,
	"message_count" integer DEFAULT 1 NOT NULL,
	"unsubscribe_url_encrypted" text,
	"unsubscribe_mailto_encrypted" text,
	"one_click" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	CONSTRAINT "bulk_sender_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "gmail_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
