CREATE TABLE "agencies" (
	"feed_version_id" uuid NOT NULL,
	"agency_id" text NOT NULL,
	"agency_name" text NOT NULL,
	"agency_url" text,
	"agency_timezone" text,
	"agency_lang" text,
	"agency_phone" text,
	CONSTRAINT "agencies_feed_version_id_agency_id_pk" PRIMARY KEY("feed_version_id","agency_id")
);
--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;