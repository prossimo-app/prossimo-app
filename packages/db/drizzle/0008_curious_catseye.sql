CREATE TABLE "calendar_dates" (
	"feed_version_id" uuid NOT NULL,
	"service_id" text NOT NULL,
	"date" date NOT NULL,
	"exception_type" integer NOT NULL,
	CONSTRAINT "calendar_dates_feed_version_id_service_id_date_pk" PRIMARY KEY("feed_version_id","service_id","date")
);
--> statement-breakpoint
ALTER TABLE "calendar_dates" ADD CONSTRAINT "calendar_dates_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_calendar_dates_feed_date" ON "calendar_dates" USING btree ("feed_version_id","date");