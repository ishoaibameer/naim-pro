CREATE TYPE "public"."custom_field_target" AS ENUM('DEAL', 'TRIP_LOADING', 'TRIP_DELIVERY', 'VENDOR', 'DRIVER', 'PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'QUANTITY_TON', 'PERCENTAGE', 'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'PHONE', 'IMAGE', 'DOCUMENT');--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"target" "custom_field_target" NOT NULL,
	"key" varchar(64) NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "custom_field_definitions_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "custom_field_definitions_org_target_key_unique" UNIQUE("organization_id","target","key"),
	CONSTRAINT "custom_field_definitions_key_format" CHECK ("custom_field_definitions"."key" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "custom_field_definitions_current_version_positive" CHECK ("custom_field_definitions"."current_version_number" > 0),
	CONSTRAINT "custom_field_definitions_version_positive" CHECK ("custom_field_definitions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "custom_field_editable_roles" (
	"organization_id" uuid NOT NULL,
	"field_version_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	CONSTRAINT "custom_field_editable_roles_organization_id_field_version_id_role_pk" PRIMARY KEY("organization_id","field_version_id","role")
);
--> statement-breakpoint
CREATE TABLE "custom_field_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"field_version_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" varchar(160) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	CONSTRAINT "custom_field_options_version_code_unique" UNIQUE("organization_id","field_version_id","code"),
	CONSTRAINT "custom_field_options_code_format" CHECK ("custom_field_options"."code" ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"definition_version_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"deal_id" uuid,
	"trip_id" uuid,
	"vendor_id" uuid,
	"driver_id" uuid,
	"payment_id" uuid,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "custom_field_values_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "custom_field_values_exactly_one_target" CHECK (num_nonnulls("custom_field_values"."deal_id", "custom_field_values"."trip_id", "custom_field_values"."vendor_id", "custom_field_values"."driver_id", "custom_field_values"."payment_id") = 1),
	CONSTRAINT "custom_field_values_version_positive" CHECK ("custom_field_values"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "custom_field_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(160) NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"section_key" varchar(64) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"required_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_versions_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "custom_field_versions_definition_id_unique" UNIQUE("organization_id","definition_id","id"),
	CONSTRAINT "custom_field_versions_number_unique" UNIQUE("organization_id","definition_id","version_number"),
	CONSTRAINT "custom_field_versions_number_positive" CHECK ("custom_field_versions"."version_number" > 0),
	CONSTRAINT "custom_field_versions_sort_nonnegative" CHECK ("custom_field_versions"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "custom_field_visible_roles" (
	"organization_id" uuid NOT NULL,
	"field_version_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	CONSTRAINT "custom_field_visible_roles_organization_id_field_version_id_role_pk" PRIMARY KEY("organization_id","field_version_id","role")
);
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_editable_roles" ADD CONSTRAINT "custom_field_editable_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_editable_roles" ADD CONSTRAINT "custom_field_editable_roles_version_fk" FOREIGN KEY ("organization_id","field_version_id") REFERENCES "public"."custom_field_versions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_options" ADD CONSTRAINT "custom_field_options_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_options" ADD CONSTRAINT "custom_field_options_version_fk" FOREIGN KEY ("organization_id","field_version_id") REFERENCES "public"."custom_field_versions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_fk" FOREIGN KEY ("organization_id","definition_id") REFERENCES "public"."custom_field_definitions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_version_fk" FOREIGN KEY ("organization_id","definition_id","definition_version_id") REFERENCES "public"."custom_field_versions"("organization_id","definition_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_vendor_fk" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_payment_fk" FOREIGN KEY ("organization_id","payment_id") REFERENCES "public"."payments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_versions" ADD CONSTRAINT "custom_field_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_versions" ADD CONSTRAINT "custom_field_versions_definition_fk" FOREIGN KEY ("organization_id","definition_id") REFERENCES "public"."custom_field_definitions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_versions" ADD CONSTRAINT "custom_field_versions_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_visible_roles" ADD CONSTRAINT "custom_field_visible_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_visible_roles" ADD CONSTRAINT "custom_field_visible_roles_version_fk" FOREIGN KEY ("organization_id","field_version_id") REFERENCES "public"."custom_field_versions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_definitions_org_target_status_idx" ON "custom_field_definitions" USING btree ("organization_id","target","status");--> statement-breakpoint
CREATE INDEX "custom_field_options_version_sort_idx" ON "custom_field_options" USING btree ("organization_id","field_version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_deal_unique" ON "custom_field_values" USING btree ("organization_id","definition_id","deal_id") WHERE "custom_field_values"."deal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_trip_unique" ON "custom_field_values" USING btree ("organization_id","definition_id","trip_id") WHERE "custom_field_values"."trip_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_vendor_unique" ON "custom_field_values" USING btree ("organization_id","definition_id","vendor_id") WHERE "custom_field_values"."vendor_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_driver_unique" ON "custom_field_values" USING btree ("organization_id","definition_id","driver_id") WHERE "custom_field_values"."driver_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_values_payment_unique" ON "custom_field_values" USING btree ("organization_id","definition_id","payment_id") WHERE "custom_field_values"."payment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "custom_field_values_target_batch_idx" ON "custom_field_values" USING btree ("organization_id","deal_id","trip_id","vendor_id","driver_id","payment_id");--> statement-breakpoint
CREATE INDEX "custom_field_versions_definition_sort_idx" ON "custom_field_versions" USING btree ("organization_id","definition_id","sort_order");