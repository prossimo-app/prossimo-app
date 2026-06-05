CREATE TABLE "stop_times" (
	"feed_version_id" uuid NOT NULL,
	"trip_id" text NOT NULL,
	"arrival_time" text,
	"departure_time" text,
	"arrival_seconds" integer,
	"departure_seconds" integer,
	"stop_id" text NOT NULL,
	"stop_sequence" integer NOT NULL,
	"stop_headsign" text,
	"pickup_type" integer,
	"drop_off_type" integer,
	"shape_dist_traveled" double precision,
	"timepoint" integer,
	CONSTRAINT "stop_times_feed_version_id_trip_id_stop_sequence_pk" PRIMARY KEY("feed_version_id","trip_id","stop_sequence")
);
--> statement-breakpoint
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stop_times_feed_stop" ON "stop_times" USING btree ("feed_version_id","stop_id");--> statement-breakpoint
CREATE INDEX "idx_stop_times_feed_trip" ON "stop_times" USING btree ("feed_version_id","trip_id");--> statement-breakpoint
CREATE INDEX "idx_stop_times_stop_departure" ON "stop_times" USING btree ("feed_version_id","stop_id","departure_seconds");