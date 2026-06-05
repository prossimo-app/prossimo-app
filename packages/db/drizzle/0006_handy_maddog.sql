CREATE TABLE "trips" (
	"feed_version_id" uuid NOT NULL,
	"trip_id" text NOT NULL,
	"route_id" text NOT NULL,
	"service_id" text NOT NULL,
	"trip_headsign" text,
	"trip_short_name" text,
	"direction_id" integer,
	"block_id" text,
	"shape_id" text,
	"wheelchair_accessible" integer,
	"bikes_allowed" integer,
	CONSTRAINT "trips_feed_version_id_trip_id_pk" PRIMARY KEY("feed_version_id","trip_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trips_feed_route" ON "trips" USING btree ("feed_version_id","route_id");--> statement-breakpoint
CREATE INDEX "idx_trips_feed_service" ON "trips" USING btree ("feed_version_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_trips_feed_shape" ON "trips" USING btree ("feed_version_id","shape_id");