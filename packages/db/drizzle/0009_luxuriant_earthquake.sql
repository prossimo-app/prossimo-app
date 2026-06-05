CREATE TABLE "shapes" (
	"feed_version_id" uuid NOT NULL,
	"shape_id" text NOT NULL,
	"shape_pt_lat" double precision NOT NULL,
	"shape_pt_lon" double precision NOT NULL,
	"shape_pt_sequence" integer NOT NULL,
	"shape_dist_traveled" double precision,
	CONSTRAINT "shapes_feed_version_id_shape_id_shape_pt_sequence_pk" PRIMARY KEY("feed_version_id","shape_id","shape_pt_sequence")
);
--> statement-breakpoint
ALTER TABLE "shapes" ADD CONSTRAINT "shapes_feed_version_id_gtfs_feed_versions_id_fk" FOREIGN KEY ("feed_version_id") REFERENCES "public"."gtfs_feed_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shapes_feed_shape" ON "shapes" USING btree ("feed_version_id","shape_id");