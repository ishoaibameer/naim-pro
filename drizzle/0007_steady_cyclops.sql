CREATE TYPE "public"."driver_check_in_type" AS ENUM('REACHED_PICKUP', 'JOURNEY_STARTED', 'REACHED_DESTINATION');--> statement-breakpoint
CREATE TYPE "public"."driver_expense_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."driver_expense_type" AS ENUM('DIESEL', 'TOLL', 'PARKING', 'OTHER');--> statement-breakpoint
CREATE TABLE "driver_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"type" "driver_check_in_type" NOT NULL,
	"note" text,
	"location_text" varchar(240),
	"actor_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_check_ins_organization_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "driver_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"type" "driver_expense_type" NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"note" text,
	"status" "driver_expense_status" DEFAULT 'PENDING' NOT NULL,
	"receipt_document_id" uuid,
	"created_by_membership_id" uuid NOT NULL,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "driver_expenses_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "driver_expenses_amount_positive" CHECK ("driver_expenses"."amount" > 0),
	CONSTRAINT "driver_expenses_version_positive" CHECK ("driver_expenses"."version" > 0),
	CONSTRAINT "driver_expenses_review_consistent" CHECK (("driver_expenses"."status" = 'PENDING' AND "driver_expenses"."reviewed_by_membership_id" IS NULL AND "driver_expenses"."reviewed_at" IS NULL) OR ("driver_expenses"."status" IN ('APPROVED', 'REJECTED') AND "driver_expenses"."reviewed_by_membership_id" IS NOT NULL AND "driver_expenses"."reviewed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "driver_check_ins" ADD CONSTRAINT "driver_check_ins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_check_ins" ADD CONSTRAINT "driver_check_ins_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_check_ins" ADD CONSTRAINT "driver_check_ins_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_check_ins" ADD CONSTRAINT "driver_check_ins_actor_fk" FOREIGN KEY ("organization_id","actor_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_receipt_document_fk" FOREIGN KEY ("organization_id","receipt_document_id") REFERENCES "public"."documents"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_creator_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_expenses" ADD CONSTRAINT "driver_expenses_reviewer_fk" FOREIGN KEY ("organization_id","reviewed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_check_ins_trip_driver_type_unique" ON "driver_check_ins" USING btree ("organization_id","trip_id","driver_id","type");--> statement-breakpoint
CREATE INDEX "driver_check_ins_trip_created_idx" ON "driver_check_ins" USING btree ("organization_id","trip_id","created_at");--> statement-breakpoint
CREATE INDEX "driver_expenses_driver_date_idx" ON "driver_expenses" USING btree ("organization_id","driver_id","expense_date");--> statement-breakpoint
CREATE INDEX "driver_expenses_trip_status_idx" ON "driver_expenses" USING btree ("organization_id","trip_id","status");