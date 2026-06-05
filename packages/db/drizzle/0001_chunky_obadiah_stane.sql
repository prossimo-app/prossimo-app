CREATE TABLE "scheduled_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"environment" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"result" text,
	"error" text,
	"schedule" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_job_name_started_at_idx" ON "scheduled_job_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_status_started_at_idx" ON "scheduled_job_runs" USING btree ("status","started_at");
