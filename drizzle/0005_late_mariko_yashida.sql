CREATE TYPE "public"."document_type" AS ENUM('VEHICLE_PHOTO', 'LOADING_PHOTO', 'WEIGHBRIDGE_SLIP', 'PAYMENT_RECEIPT', 'DELIVERY_CHALLAN', 'BILL', 'PERMIT', 'OTHER');--> statement-breakpoint
CREATE TABLE "document_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"deal_id" uuid,
	"trip_id" uuid,
	"payment_id" uuid,
	"bill_id" uuid,
	"vehicle_id" uuid,
	"vendor_id" uuid,
	"driver_id" uuid,
	"created_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_attachments_exactly_one_target" CHECK (num_nonnulls("document_attachments"."deal_id", "document_attachments"."trip_id", "document_attachments"."payment_id", "document_attachments"."bill_id", "document_attachments"."vehicle_id", "document_attachments"."vendor_id", "document_attachments"."driver_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_key" varchar(320) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"uploaded_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "document_versions_number_unique" UNIQUE("organization_id","document_id","version_number"),
	CONSTRAINT "document_versions_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "document_versions_number_positive" CHECK ("document_versions"."version_number" > 0),
	CONSTRAINT "document_versions_size_positive" CHECK ("document_versions"."size_bytes" > 0),
	CONSTRAINT "document_versions_size_limited" CHECK ("document_versions"."size_bytes" <= 15728640),
	CONSTRAINT "document_versions_mime_allowed" CHECK ("document_versions"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
	CONSTRAINT "document_versions_checksum_valid" CHECK ("document_versions"."checksum_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text,
	"profile_key" varchar(160),
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"retired_by_membership_id" uuid,
	"retired_at" timestamp with time zone,
	"retired_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "documents_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "documents_current_version_positive" CHECK ("documents"."current_version_number" > 0),
	CONSTRAINT "documents_version_positive" CHECK ("documents"."version" > 0),
	CONSTRAINT "documents_profile_key_type" CHECK ("documents"."profile_key" IS NULL OR "documents"."document_type" = 'VEHICLE_PHOTO'),
	CONSTRAINT "documents_retirement_consistent" CHECK (("documents"."status" = 'ACTIVE' AND "documents"."retired_at" IS NULL AND "documents"."retired_by_membership_id" IS NULL AND "documents"."retired_reason" IS NULL) OR ("documents"."status" = 'INACTIVE' AND "documents"."retired_at" IS NOT NULL AND "documents"."retired_by_membership_id" IS NOT NULL AND "documents"."retired_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_fk" FOREIGN KEY ("organization_id","document_id") REFERENCES "public"."documents"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_payment_fk" FOREIGN KEY ("organization_id","payment_id") REFERENCES "public"."payments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_bill_fk" FOREIGN KEY ("organization_id","bill_id") REFERENCES "public"."bills"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_vehicle_fk" FOREIGN KEY ("organization_id","vehicle_id") REFERENCES "public"."vehicles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_vendor_fk" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_fk" FOREIGN KEY ("organization_id","document_id") REFERENCES "public"."documents"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_fk" FOREIGN KEY ("organization_id","uploaded_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_retired_by_fk" FOREIGN KEY ("organization_id","retired_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_attachments_document_target_unique" ON "document_attachments" USING btree ("organization_id","document_id","deal_id","trip_id","payment_id","bill_id","vehicle_id","vendor_id","driver_id");--> statement-breakpoint
CREATE INDEX "document_attachments_deal_idx" ON "document_attachments" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX "document_attachments_trip_idx" ON "document_attachments" USING btree ("organization_id","trip_id");--> statement-breakpoint
CREATE INDEX "document_attachments_payment_idx" ON "document_attachments" USING btree ("organization_id","payment_id");--> statement-breakpoint
CREATE INDEX "document_attachments_bill_idx" ON "document_attachments" USING btree ("organization_id","bill_id");--> statement-breakpoint
CREATE INDEX "document_attachments_vehicle_idx" ON "document_attachments" USING btree ("organization_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "document_attachments_vendor_idx" ON "document_attachments" USING btree ("organization_id","vendor_id");--> statement-breakpoint
CREATE INDEX "document_attachments_driver_idx" ON "document_attachments" USING btree ("organization_id","driver_id");--> statement-breakpoint
CREATE INDEX "document_versions_checksum_idx" ON "document_versions" USING btree ("organization_id","checksum_sha256");--> statement-breakpoint
CREATE INDEX "documents_org_type_created_idx" ON "documents" USING btree ("organization_id","document_type","created_at");--> statement-breakpoint
CREATE INDEX "documents_org_status_created_idx" ON "documents" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_org_profile_key_unique" ON "documents" USING btree ("organization_id","profile_key") WHERE "documents"."profile_key" IS NOT NULL;