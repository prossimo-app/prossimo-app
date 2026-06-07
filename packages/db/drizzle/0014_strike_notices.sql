CREATE TABLE "strike_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link" text,
	"published_at" timestamp with time zone,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"relevance_status" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strike_notices_source_id_unique" UNIQUE("source","source_id"),
	CONSTRAINT "strike_notices_source_hash_unique" UNIQUE("source","source_hash")
);
--> statement-breakpoint
CREATE INDEX "strike_notices_source_relevance_starts_idx" ON "strike_notices" USING btree ("source","relevance_status","starts_at");
--> statement-breakpoint
CREATE INDEX "strike_notices_published_idx" ON "strike_notices" USING btree ("published_at");
