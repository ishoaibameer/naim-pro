CREATE TYPE "public"."bill_status" AS ENUM('DRAFT', 'ISSUED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('DRAFT', 'ACTIVE', 'FULFILLED', 'CANCELLED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('INFO', 'ACTION_REQUIRED', 'WARNING');--> statement-breakpoint
CREATE TYPE "public"."payment_direction" AS ENUM('OUTGOING', 'INCOMING');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('ADVANCE', 'PARTIAL', 'FINAL', 'REFUND', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'MEMBER', 'VENDOR', 'DRIVER');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('CREATED', 'TRUCK_ASSIGNED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED', 'ARCHIVED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_membership_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(80),
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_events_entity_pair" CHECK (("activity_events"."entity_type" IS NULL) = ("activity_events"."entity_id" IS NULL)),
	CONSTRAINT "activity_events_actor_pair" CHECK (("activity_events"."actor_user_id" IS NULL) = ("activity_events"."actor_membership_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_membership_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"request_id" varchar(100),
	"correlation_id" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_pair" CHECK (("audit_events"."actor_user_id" IS NULL) = ("audit_events"."actor_membership_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"recipient_membership_id" uuid NOT NULL,
	"type" "notification_type" DEFAULT 'INFO' NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(80),
	"entity_id" uuid,
	"dedupe_key" varchar(180),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_entity_pair" CHECK (("notifications"."entity_type" IS NULL) = ("notifications"."entity_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity_mt" numeric(12, 3) NOT NULL,
	"rate" numeric(14, 2) NOT NULL,
	"line_amount" numeric(16, 2) NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	CONSTRAINT "bill_lines_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "bill_lines_quantity_positive" CHECK ("bill_lines"."quantity_mt" > 0),
	CONSTRAINT "bill_lines_rate_nonnegative" CHECK ("bill_lines"."rate" >= 0),
	CONSTRAINT "bill_lines_amount_nonnegative" CHECK ("bill_lines"."line_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"bill_number" varchar(64) NOT NULL,
	"bill_date" date NOT NULL,
	"status" "bill_status" DEFAULT 'DRAFT' NOT NULL,
	"total_amount" numeric(16, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"issued_at" timestamp with time zone,
	"issued_by_membership_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_membership_id" uuid,
	"void_reason" text,
	"replacement_for_bill_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bills_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "bills_org_number_unique" UNIQUE("organization_id","bill_number"),
	CONSTRAINT "bills_total_nonnegative" CHECK ("bills"."total_amount" >= 0),
	CONSTRAINT "bills_currency_inr" CHECK ("bills"."currency" = 'INR'),
	CONSTRAINT "bills_version_positive" CHECK ("bills"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"deal_id" uuid,
	"trip_id" uuid,
	"bill_id" uuid,
	"amount" numeric(16, 2) NOT NULL,
	"allocated_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_exactly_one_target" CHECK (num_nonnulls("payment_allocations"."deal_id", "payment_allocations"."trip_id", "payment_allocations"."bill_id") = 1),
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_number" varchar(64) NOT NULL,
	"direction" "payment_direction" NOT NULL,
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'DRAFT' NOT NULL,
	"vendor_id" uuid,
	"transporter_id" uuid,
	"company_id" uuid,
	"amount" numeric(16, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"payment_date" date NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"receipt_number" varchar(100),
	"normalized_receipt_number" varchar(100),
	"notes" text,
	"recorded_by_membership_id" uuid NOT NULL,
	"paid_by_membership_id" uuid,
	"reversal_of_payment_id" uuid,
	"reversal_reason" text,
	"posted_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "payments_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "payments_org_number_unique" UNIQUE("organization_id","payment_number"),
	CONSTRAINT "payments_exactly_one_counterparty" CHECK (num_nonnulls("payments"."vendor_id", "payments"."transporter_id", "payments"."company_id") = 1),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_currency_inr" CHECK ("payments"."currency" = 'INR'),
	CONSTRAINT "payments_not_own_reversal" CHECK ("payments"."reversal_of_payment_id" IS NULL OR "payments"."reversal_of_payment_id" <> "payments"."id"),
	CONSTRAINT "payments_reversal_reason_required" CHECK ("payments"."reversal_of_payment_id" IS NULL OR "payments"."reversal_reason" IS NOT NULL),
	CONSTRAINT "payments_status_timestamps" CHECK (("payments"."status" = 'DRAFT' AND "payments"."posted_at" IS NULL AND "payments"."reversed_at" IS NULL) OR ("payments"."status" = 'POSTED' AND "payments"."posted_at" IS NOT NULL AND "payments"."reversed_at" IS NULL) OR ("payments"."status" = 'REVERSED' AND "payments"."posted_at" IS NOT NULL AND "payments"."reversed_at" IS NOT NULL)),
	CONSTRAINT "payments_version_positive" CHECK ("payments"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "memberships_organization_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "memberships_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "memberships_org_id_user_unique" UNIQUE("organization_id","id","user_id"),
	CONSTRAINT "memberships_version_positive" CHECK ("memberships"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"legal_name" varchar(200),
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "organizations_version_positive" CHECK ("organizations"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"active_membership_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "sessions_expiry_after_creation" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" varchar(16) NOT NULL,
	"password_hash" text NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "users_phone_e164_format" CHECK ("users"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "users_version_positive" CHECK ("users"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "deal_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_status" "deal_status",
	"to_status" "deal_status" NOT NULL,
	"changed_by_membership_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_number" varchar(48) NOT NULL,
	"vendor_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"pickup_location_id" uuid NOT NULL,
	"purchase_rate" numeric(14, 2) NOT NULL,
	"expected_quantity_mt" numeric(12, 3),
	"owner_membership_id" uuid NOT NULL,
	"status" "deal_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "deals_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "deals_org_number_unique" UNIQUE("organization_id","deal_number"),
	CONSTRAINT "deals_rate_nonnegative" CHECK ("deals"."purchase_rate" >= 0),
	CONSTRAINT "deals_expected_quantity_nonnegative" CHECK ("deals"."expected_quantity_mt" IS NULL OR "deals"."expected_quantity_mt" >= 0),
	CONSTRAINT "deals_version_positive" CHECK ("deals"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "trip_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"transporter_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"changed_by_membership_id" uuid NOT NULL,
	"reason" text,
	CONSTRAINT "trip_assignments_period_valid" CHECK ("trip_assignments"."ended_at" IS NULL OR "trip_assignments"."ended_at" > "trip_assignments"."assigned_at")
);
--> statement-breakpoint
CREATE TABLE "trip_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"loaded_weight_mt" numeric(12, 3) NOT NULL,
	"final_weight_mt" numeric(12, 3) NOT NULL,
	"accepted_final_weight_mt" numeric(12, 3) NOT NULL,
	"purchase_rate" numeric(14, 2) NOT NULL,
	"weight_difference_mt" numeric(12, 3) NOT NULL,
	"weight_difference_percent" numeric(9, 4),
	"purchase_amount" numeric(16, 2) NOT NULL,
	"source_trip_version" integer NOT NULL,
	"posted_by_membership_id" uuid NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by_membership_id" uuid,
	"reversal_reason" text,
	"replacement_for_settlement_id" uuid,
	CONSTRAINT "trip_settlements_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "trip_settlements_weights_nonnegative" CHECK ("trip_settlements"."loaded_weight_mt" >= 0 AND "trip_settlements"."final_weight_mt" >= 0 AND "trip_settlements"."accepted_final_weight_mt" >= 0),
	CONSTRAINT "trip_settlements_rate_nonnegative" CHECK ("trip_settlements"."purchase_rate" >= 0),
	CONSTRAINT "trip_settlements_amount_nonnegative" CHECK ("trip_settlements"."purchase_amount" >= 0),
	CONSTRAINT "trip_settlements_source_version_positive" CHECK ("trip_settlements"."source_trip_version" > 0),
	CONSTRAINT "trip_settlements_reversal_complete" CHECK (("trip_settlements"."reversed_at" IS NULL AND "trip_settlements"."reversed_by_membership_id" IS NULL AND "trip_settlements"."reversal_reason" IS NULL) OR ("trip_settlements"."reversed_at" IS NOT NULL AND "trip_settlements"."reversed_by_membership_id" IS NOT NULL AND "trip_settlements"."reversal_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "trip_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"from_status" "trip_status",
	"to_status" "trip_status" NOT NULL,
	"changed_by_membership_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trip_number" varchar(48) NOT NULL,
	"deal_id" uuid NOT NULL,
	"destination_company_id" uuid NOT NULL,
	"pickup_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"current_transporter_id" uuid,
	"current_driver_id" uuid,
	"current_vehicle_id" uuid,
	"owner_membership_id" uuid NOT NULL,
	"status" "trip_status" DEFAULT 'CREATED' NOT NULL,
	"loaded_weight_mt" numeric(12, 3),
	"final_weight_mt" numeric(12, 3),
	"accepted_final_weight_mt" numeric(12, 3),
	"challan_number" varchar(80),
	"normalized_challan_number" varchar(80),
	"weighment_card_number" varchar(80),
	"normalized_weighment_card_number" varchar(80),
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "trips_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "trips_org_number_unique" UNIQUE("organization_id","trip_number"),
	CONSTRAINT "trips_loaded_weight_nonnegative" CHECK ("trips"."loaded_weight_mt" IS NULL OR "trips"."loaded_weight_mt" >= 0),
	CONSTRAINT "trips_final_weight_nonnegative" CHECK ("trips"."final_weight_mt" IS NULL OR "trips"."final_weight_mt" >= 0),
	CONSTRAINT "trips_accepted_weight_nonnegative" CHECK ("trips"."accepted_final_weight_mt" IS NULL OR "trips"."accepted_final_weight_mt" >= 0),
	CONSTRAINT "trips_delivery_after_dispatch" CHECK ("trips"."dispatched_at" IS NULL OR "trips"."delivered_at" IS NULL OR "trips"."delivered_at" >= "trips"."dispatched_at"),
	CONSTRAINT "trips_assignment_required_by_stage" CHECK ("trips"."status" NOT IN ('TRUCK_ASSIGNED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR ("trips"."current_transporter_id" IS NOT NULL AND "trips"."current_driver_id" IS NOT NULL AND "trips"."current_vehicle_id" IS NOT NULL)),
	CONSTRAINT "trips_loaded_data_required_by_stage" CHECK ("trips"."status" NOT IN ('LOADED', 'IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR "trips"."loaded_weight_mt" > 0),
	CONSTRAINT "trips_dispatch_data_required_by_stage" CHECK ("trips"."status" NOT IN ('IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR ("trips"."challan_number" IS NOT NULL AND "trips"."dispatched_at" IS NOT NULL)),
	CONSTRAINT "trips_delivery_data_required_by_stage" CHECK ("trips"."status" NOT IN ('DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR ("trips"."final_weight_mt" IS NOT NULL AND "trips"."weighment_card_number" IS NOT NULL AND "trips"."delivered_at" IS NOT NULL)),
	CONSTRAINT "trips_accepted_weight_required_by_stage" CHECK ("trips"."status" NOT IN ('SETTLEMENT_PENDING', 'SETTLED') OR "trips"."accepted_final_weight_mt" IS NOT NULL),
	CONSTRAINT "trips_version_positive" CHECK ("trips"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"phone_e164" varchar(16),
	"billing_address" text,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "companies_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "companies_version_positive" CHECK ("companies"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "driver_transporter_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"transporter_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by_membership_id" uuid NOT NULL,
	"reason" text,
	CONSTRAINT "driver_transporter_period_valid" CHECK ("driver_transporter_assignments"."valid_to" IS NULL OR "driver_transporter_assignments"."valid_to" > "driver_transporter_assignments"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"phone_e164" varchar(16),
	"user_id" uuid,
	"license_number" varchar(80),
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "drivers_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "drivers_version_positive" CHECK ("drivers"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"address" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "locations_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "locations_latitude_range" CHECK ("locations"."latitude" IS NULL OR "locations"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "locations_longitude_range" CHECK ("locations"."longitude" IS NULL OR "locations"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "locations_version_positive" CHECK ("locations"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"normalized_name" varchar(160) NOT NULL,
	"description" text,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "materials_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "materials_org_name_unique" UNIQUE("organization_id","normalized_name"),
	CONSTRAINT "materials_version_positive" CHECK ("materials"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "transporters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"phone_e164" varchar(16),
	"notes" text,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "transporters_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "transporters_version_positive" CHECK ("transporters"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "vehicle_transporter_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"transporter_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by_membership_id" uuid NOT NULL,
	"reason" text,
	CONSTRAINT "vehicle_transporter_period_valid" CHECK ("vehicle_transporter_assignments"."valid_to" IS NULL OR "vehicle_transporter_assignments"."valid_to" > "vehicle_transporter_assignments"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"registration_number" varchar(32) NOT NULL,
	"normalized_registration_number" varchar(32) NOT NULL,
	"vehicle_type" varchar(80),
	"capacity_mt" numeric(12, 3),
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "vehicles_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "vehicles_org_registration_unique" UNIQUE("organization_id","normalized_registration_number"),
	CONSTRAINT "vehicles_capacity_nonnegative" CHECK ("vehicles"."capacity_mt" IS NULL OR "vehicles"."capacity_mt" >= 0),
	CONSTRAINT "vehicles_version_positive" CHECK ("vehicles"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"user_id" uuid,
	"phone_e164" varchar(16),
	"notes" text,
	"created_by_membership_id" uuid NOT NULL,
	"updated_by_membership_id" uuid NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "vendors_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "vendors_version_positive" CHECK ("vendors"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_membership_fk" FOREIGN KEY ("organization_id","actor_membership_id","actor_user_id") REFERENCES "public"."memberships"("organization_id","id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_membership_fk" FOREIGN KEY ("organization_id","actor_membership_id","actor_user_id") REFERENCES "public"."memberships"("organization_id","id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_fk" FOREIGN KEY ("organization_id","recipient_membership_id","recipient_user_id") REFERENCES "public"."memberships"("organization_id","id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_fk" FOREIGN KEY ("organization_id","bill_id") REFERENCES "public"."bills"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_company_fk" FOREIGN KEY ("organization_id","company_id") REFERENCES "public"."companies"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_issued_by_fk" FOREIGN KEY ("organization_id","issued_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_voided_by_fk" FOREIGN KEY ("organization_id","voided_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_replacement_fk" FOREIGN KEY ("organization_id","replacement_for_bill_id") REFERENCES "public"."bills"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_fk" FOREIGN KEY ("organization_id","payment_id") REFERENCES "public"."payments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bill_fk" FOREIGN KEY ("organization_id","bill_id") REFERENCES "public"."bills"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_actor_fk" FOREIGN KEY ("organization_id","allocated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_fk" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_transporter_fk" FOREIGN KEY ("organization_id","transporter_id") REFERENCES "public"."transporters"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_fk" FOREIGN KEY ("organization_id","company_id") REFERENCES "public"."companies"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fk" FOREIGN KEY ("organization_id","recorded_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_by_fk" FOREIGN KEY ("organization_id","paid_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_fk" FOREIGN KEY ("organization_id","reversal_of_payment_id") REFERENCES "public"."payments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_membership_fk" FOREIGN KEY ("organization_id","active_membership_id","user_id") REFERENCES "public"."memberships"("organization_id","id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_events" ADD CONSTRAINT "deal_status_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_events" ADD CONSTRAINT "deal_status_events_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_events" ADD CONSTRAINT "deal_status_events_actor_fk" FOREIGN KEY ("organization_id","changed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_vendor_fk" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_material_fk" FOREIGN KEY ("organization_id","material_id") REFERENCES "public"."materials"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pickup_location_fk" FOREIGN KEY ("organization_id","pickup_location_id") REFERENCES "public"."locations"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_transporter_fk" FOREIGN KEY ("organization_id","transporter_id") REFERENCES "public"."transporters"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_vehicle_fk" FOREIGN KEY ("organization_id","vehicle_id") REFERENCES "public"."vehicles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_actor_fk" FOREIGN KEY ("organization_id","changed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_posted_by_fk" FOREIGN KEY ("organization_id","posted_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_reversed_by_fk" FOREIGN KEY ("organization_id","reversed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_replacement_fk" FOREIGN KEY ("organization_id","replacement_for_settlement_id") REFERENCES "public"."trip_settlements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_events" ADD CONSTRAINT "trip_status_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_events" ADD CONSTRAINT "trip_status_events_trip_fk" FOREIGN KEY ("organization_id","trip_id") REFERENCES "public"."trips"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_events" ADD CONSTRAINT "trip_status_events_actor_fk" FOREIGN KEY ("organization_id","changed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_company_fk" FOREIGN KEY ("organization_id","destination_company_id") REFERENCES "public"."companies"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_pickup_location_fk" FOREIGN KEY ("organization_id","pickup_location_id") REFERENCES "public"."locations"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_location_fk" FOREIGN KEY ("organization_id","destination_location_id") REFERENCES "public"."locations"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_current_transporter_fk" FOREIGN KEY ("organization_id","current_transporter_id") REFERENCES "public"."transporters"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_current_driver_fk" FOREIGN KEY ("organization_id","current_driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_current_vehicle_fk" FOREIGN KEY ("organization_id","current_vehicle_id") REFERENCES "public"."vehicles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_owner_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transporter_assignments" ADD CONSTRAINT "driver_transporter_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transporter_assignments" ADD CONSTRAINT "driver_transporter_driver_fk" FOREIGN KEY ("organization_id","driver_id") REFERENCES "public"."drivers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transporter_assignments" ADD CONSTRAINT "driver_transporter_transporter_fk" FOREIGN KEY ("organization_id","transporter_id") REFERENCES "public"."transporters"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transporter_assignments" ADD CONSTRAINT "driver_transporter_actor_fk" FOREIGN KEY ("organization_id","changed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_membership_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transporters" ADD CONSTRAINT "transporters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transporters" ADD CONSTRAINT "transporters_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transporters" ADD CONSTRAINT "transporters_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transporter_assignments" ADD CONSTRAINT "vehicle_transporter_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transporter_assignments" ADD CONSTRAINT "vehicle_transporter_vehicle_fk" FOREIGN KEY ("organization_id","vehicle_id") REFERENCES "public"."vehicles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transporter_assignments" ADD CONSTRAINT "vehicle_transporter_transporter_fk" FOREIGN KEY ("organization_id","transporter_id") REFERENCES "public"."transporters"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transporter_assignments" ADD CONSTRAINT "vehicle_transporter_actor_fk" FOREIGN KEY ("organization_id","changed_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_membership_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_fk" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_updated_by_fk" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_org_created_idx" ON "activity_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_entity_idx" ON "activity_events" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("organization_id","actor_membership_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_org_dedupe_unique" ON "notifications" USING btree ("organization_id","dedupe_key") WHERE "notifications"."dedupe_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("organization_id","recipient_membership_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_lines_active_trip_unique" ON "bill_lines" USING btree ("organization_id","trip_id") WHERE "bill_lines"."voided_at" IS NULL;--> statement-breakpoint
CREATE INDEX "bill_lines_bill_idx" ON "bill_lines" USING btree ("organization_id","bill_id");--> statement-breakpoint
CREATE INDEX "bills_org_company_status_idx" ON "bills" USING btree ("organization_id","company_id","status");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("organization_id","payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_deal_idx" ON "payment_allocations" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_trip_idx" ON "payment_allocations" USING btree ("organization_id","trip_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_bill_idx" ON "payment_allocations" USING btree ("organization_id","bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reversal_of_unique" ON "payments" USING btree ("organization_id","reversal_of_payment_id") WHERE "payments"."reversal_of_payment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_org_status_date_idx" ON "payments" USING btree ("organization_id","status","payment_date");--> statement-breakpoint
CREATE INDEX "payments_org_date_idx" ON "payments" USING btree ("organization_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_org_vendor_idx" ON "payments" USING btree ("organization_id","vendor_id");--> statement-breakpoint
CREATE INDEX "payments_org_transporter_idx" ON "payments" USING btree ("organization_id","transporter_id");--> statement-breakpoint
CREATE INDEX "payments_org_company_idx" ON "payments" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "payments_org_receipt_idx" ON "payments" USING btree ("organization_id","normalized_receipt_number");--> statement-breakpoint
CREATE INDEX "memberships_user_status_idx" ON "memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_membership_expires_idx" ON "sessions" USING btree ("active_membership_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_e164_unique" ON "users" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "deal_status_events_deal_created_idx" ON "deal_status_events" USING btree ("organization_id","deal_id","created_at");--> statement-breakpoint
CREATE INDEX "deals_org_status_idx" ON "deals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "deals_org_vendor_idx" ON "deals" USING btree ("organization_id","vendor_id");--> statement-breakpoint
CREATE INDEX "deals_org_owner_idx" ON "deals" USING btree ("organization_id","owner_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_assignments_open_trip_unique" ON "trip_assignments" USING btree ("organization_id","trip_id") WHERE "trip_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trip_assignments_driver_period_idx" ON "trip_assignments" USING btree ("organization_id","driver_id","assigned_at","ended_at");--> statement-breakpoint
CREATE INDEX "trip_assignments_vehicle_period_idx" ON "trip_assignments" USING btree ("organization_id","vehicle_id","assigned_at","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_settlements_active_trip_unique" ON "trip_settlements" USING btree ("organization_id","trip_id") WHERE "trip_settlements"."reversed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trip_status_events_trip_created_idx" ON "trip_status_events" USING btree ("organization_id","trip_id","created_at");--> statement-breakpoint
CREATE INDEX "trips_org_status_idx" ON "trips" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "trips_org_created_idx" ON "trips" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "trips_org_deal_idx" ON "trips" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX "trips_org_company_idx" ON "trips" USING btree ("organization_id","destination_company_id");--> statement-breakpoint
CREATE INDEX "trips_org_driver_status_idx" ON "trips" USING btree ("organization_id","current_driver_id","status");--> statement-breakpoint
CREATE INDEX "trips_org_vehicle_status_idx" ON "trips" USING btree ("organization_id","current_vehicle_id","status");--> statement-breakpoint
CREATE INDEX "trips_org_transporter_status_idx" ON "trips" USING btree ("organization_id","current_transporter_id","status");--> statement-breakpoint
CREATE INDEX "trips_org_challan_idx" ON "trips" USING btree ("organization_id","normalized_challan_number");--> statement-breakpoint
CREATE INDEX "trips_org_weighment_card_idx" ON "trips" USING btree ("organization_id","normalized_weighment_card_number");--> statement-breakpoint
CREATE INDEX "companies_org_name_idx" ON "companies" USING btree ("organization_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_transporter_open_unique" ON "driver_transporter_assignments" USING btree ("organization_id","driver_id") WHERE "driver_transporter_assignments"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "driver_transporter_transporter_idx" ON "driver_transporter_assignments" USING btree ("organization_id","transporter_id","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_org_user_unique" ON "drivers" USING btree ("organization_id","user_id") WHERE "drivers"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_org_phone_unique" ON "drivers" USING btree ("organization_id","phone_e164") WHERE "drivers"."phone_e164" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "drivers_org_name_idx" ON "drivers" USING btree ("organization_id","normalized_name");--> statement-breakpoint
CREATE INDEX "locations_org_name_idx" ON "locations" USING btree ("organization_id","normalized_name");--> statement-breakpoint
CREATE INDEX "transporters_org_name_idx" ON "transporters" USING btree ("organization_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_transporter_open_unique" ON "vehicle_transporter_assignments" USING btree ("organization_id","vehicle_id") WHERE "vehicle_transporter_assignments"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "vehicle_transporter_transporter_idx" ON "vehicle_transporter_assignments" USING btree ("organization_id","transporter_id","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_org_user_unique" ON "vendors" USING btree ("organization_id","user_id") WHERE "vendors"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendors_org_name_idx" ON "vendors" USING btree ("organization_id","normalized_name");
--> statement-breakpoint
-- Drizzle does not model triggers. This documented custom addition makes audit
-- evidence append-only; production roles should also deny direct UPDATE and
-- DELETE privileges as defense in depth.
CREATE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();
