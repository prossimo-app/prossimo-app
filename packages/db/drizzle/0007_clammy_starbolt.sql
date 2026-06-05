CREATE TABLE "calendars" (
	"feed_version_id" uuid NOT NULL,
	"service_id" text NOT NULL,
	"monday" boolean NOT NULL,
	"tuesday" boolean NOT NULL,
	"wednesday" boolean NOT NULL,
	"thursday" boolean NOT NULL,
	"friday" boolean NOT NULL,
	"saturday" boolean NOT NULL,
	"sunday" boolean NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "calendars_feed_version_id_service_id_pk" PRIMARY KEY("feed_version_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;