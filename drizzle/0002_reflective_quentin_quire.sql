ALTER TABLE "companies" ADD COLUMN "contact_person" varchar(160);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "location" varchar(180);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "type" varchar(24);--> statement-breakpoint
ALTER TABLE "transporters" ADD COLUMN "contact_person" varchar(160);--> statement-breakpoint
ALTER TABLE "transporters" ADD COLUMN "location" varchar(180);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "contact_person" varchar(160);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "location" varchar(180);--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_type_valid" CHECK ("locations"."type" IS NULL OR "locations"."type" IN ('PICKUP', 'DESTINATION', 'OTHER'));