CREATE TABLE "route_service_days" (
	"feed_version_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"route_id" text NOT NULL,
	"route_short_name" text,
	"route_type" integer,
	"first_departure_seconds" integer,
	"last_arrival_seconds" integer,
	"trip_count" integer DEFAULT 0 NOT NULL,
	"service_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "route_service_days_feed_version_id_service_date_route_id_pk" PRIMARY KEY("feed_version_id","service_date","route_id")
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"feed_version_id" uuid NOT NULL,
	"route_id" text NOT NULL,
	"direction_id" integer NOT NULL,
	"stop_id" text NOT NULL,
	"stop_sequence" integer NOT NULL,
	"representative_trip_id" text,
	CONSTRAINT "route_stops_feed_route_direction_sequence_pk" PRIMARY KEY("feed_version_id","route_id","direction_id","stop_sequence")
);
--> statement-breakpoint
CREATE TABLE "stop_routes" (
	"feed_version_id" uuid NOT NULL,
	"stop_id" text NOT NULL,
	"route_id" text NOT NULL,
	"route_short_name" text,
	"route_type" integer,
	"direction_id" integer NOT NULL,
	"trip_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stop_routes_feed_version_id_stop_id_route_id_direction_id_pk" PRIMARY KEY("feed_version_id","stop_id","route_id","direction_id")
);
--> statement-breakpoint
ALTER TABLE "route_service_days" ADD CONSTRAINT "route_service_days_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_routes" ADD CONSTRAINT "stop_routes_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_route_service_days_date" ON "route_service_days" USING btree ("feed_version_id","service_date");--> statement-breakpoint
CREATE INDEX "idx_route_stops_route" ON "route_stops" USING btree ("feed_version_id","route_id","direction_id");--> statement-breakpoint
CREATE INDEX "idx_stop_routes_stop" ON "stop_routes" USING btree ("feed_version_id","stop_id");--> statement-breakpoint
CREATE INDEX "idx_stop_routes_route" ON "stop_routes" USING btree ("feed_version_id","route_id");
