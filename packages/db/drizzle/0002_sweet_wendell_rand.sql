CREATE TABLE "gtfs_feed_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_url" text NOT NULL,
	"zip_byte_length" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"feed_version_id" uuid NOT NULL,
	"route_id" text NOT NULL,
	"agency_id" text,
	"route_short_name" text,
	"route_long_name" text,
	"route_desc" text,
	"route_type" integer NOT NULL,
	"route_url" text,
	"route_color" text,
	"route_text_color" text,
	CONSTRAINT "routes_feed_version_id_route_id_pk" PRIMARY KEY("feed_version_id","route_id")
);
--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_routes_feed_short_name" ON "routes" USING btree ("feed_version_id","route_short_name");