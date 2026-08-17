ALTER TABLE "organizations" ADD COLUMN "weight_warning_threshold_pct" numeric(6, 3) DEFAULT '1.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "expected_transit_duration_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_page_size" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_weight_threshold_range" CHECK ("organizations"."weight_warning_threshold_pct" > 0 AND "organizations"."weight_warning_threshold_pct" <= 100);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_transit_duration_range" CHECK ("organizations"."expected_transit_duration_hours" BETWEEN 1 AND 720);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_default_page_size_range" CHECK ("organizations"."default_page_size" BETWEEN 10 AND 100);