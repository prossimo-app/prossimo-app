CREATE TABLE "gtfs_realtime_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"feed_entity_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"cause" integer,
	"effect" integer,
	"severity_level" integer,
	"header_text" jsonb,
	"description_text" jsonb,
	"url" jsonb,
	"active_periods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_alert" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feed_timestamp" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gtfs_realtime_alerts_source_entity_unique" UNIQUE("source","feed_entity_id")
);
--> statement-breakpoint
CREATE TABLE "gtfs_realtime_alert_informed_entities" (
	"alert_id" uuid NOT NULL,
	"selector_index" integer NOT NULL,
	"agency_id" text,
	"route_id" text,
	"route_type" integer,
	"direction_id" integer,
	"stop_id" text,
	"trip_id" text,
	"trip_route_id" text,
	"trip_start_date" text,
	"trip_start_time" text,
	"selector" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "gtfs_realtime_alert_informed_entities_pk" PRIMARY KEY("alert_id","selector_index")
);
--> statement-breakpoint
ALTER TABLE "gtfs_realtime_alert_informed_entities" ADD CONSTRAINT "gtfs_realtime_alert_informed_entities_alert_id_gtfs_realtime_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."gtfs_realtime_alerts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alerts_source_ended_idx" ON "gtfs_realtime_alerts" USING btree ("source","ended_at");
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alerts_last_seen_idx" ON "gtfs_realtime_alerts" USING btree ("last_seen_at");
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alert_entities_route_idx" ON "gtfs_realtime_alert_informed_entities" USING btree ("route_id");
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alert_entities_stop_idx" ON "gtfs_realtime_alert_informed_entities" USING btree ("stop_id");
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alert_entities_trip_idx" ON "gtfs_realtime_alert_informed_entities" USING btree ("trip_id");
--> statement-breakpoint
CREATE INDEX "gtfs_realtime_alert_entities_type_idx" ON "gtfs_realtime_alert_informed_entities" USING btree ("route_type");
