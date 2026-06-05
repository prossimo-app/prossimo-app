CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;--> statement-breakpoint
CREATE TABLE "stops" (
	"feed_version_id" uuid NOT NULL,
	"stop_id" text NOT NULL,
	"stop_code" text,
	"stop_name" text NOT NULL,
	"stop_desc" text,
	"stop_lat" double precision NOT NULL,
	"stop_lon" double precision NOT NULL,
	"location" GEOGRAPHY GENERATED ALWAYS AS (public.ST_SetSRID(public.ST_MakePoint(stop_lon, stop_lat), 4326)::public.geography) STORED,
	"zone_id" text,
	"stop_url" text,
	"location_type" integer,
	"parent_station" text,
	"wheelchair_boarding" integer,
	CONSTRAINT "stops_feed_version_id_stop_id_pk" PRIMARY KEY("feed_version_id","stop_id")
);
--> statement-breakpoint
ALTER TABLE "stops" ADD CONSTRAINT "stops_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stops_location" ON "stops" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_stops_name" ON "stops" USING gin (to_tsvector('simple', "stop_name"));--> statement-breakpoint
CREATE INDEX "idx_stops_feed_code" ON "stops" USING btree ("feed_version_id","stop_code");
