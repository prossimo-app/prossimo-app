ALTER TABLE "gtfs_feed_versions" ADD COLUMN "sha256_hash" text;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "downloaded_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "service_start_date" date;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "service_end_date" date;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "routes_count" integer;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "stops_count" integer;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "trips_count" integer;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "stop_times_count" integer;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "shapes_count" integer;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "gtfs_feed_versions" SET "sha256_hash" = 'legacy-' || "id"::text WHERE "sha256_hash" IS NULL;--> statement-breakpoint
UPDATE "gtfs_feed_versions" SET "status" = 'imported' WHERE "imported_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ALTER COLUMN "sha256_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ALTER COLUMN "imported_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gtfs_feed_versions" ALTER COLUMN "imported_at" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "gtfs_feed_versions_sha256_hash_unique" ON "gtfs_feed_versions" USING btree ("sha256_hash");
