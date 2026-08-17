ALTER TABLE "trip_settlements" DROP CONSTRAINT "trip_settlements_amount_nonnegative";--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "idempotency_key" varchar(80);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "idempotency_key" varchar(80);--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD COLUMN "vendor_paid_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD COLUMN "agreed_freight_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD COLUMN "transporter_paid_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD COLUMN "billed_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD COLUMN "company_received_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "agreed_freight_amount" numeric(16, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "bills_org_idempotency_unique" ON "bills" USING btree ("organization_id","idempotency_key") WHERE "bills"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_org_idempotency_unique" ON "payments" USING btree ("organization_id","idempotency_key") WHERE "payments"."idempotency_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_settlements" ADD CONSTRAINT "trip_settlements_amount_nonnegative" CHECK ("trip_settlements"."purchase_amount" >= 0 AND "trip_settlements"."vendor_paid_amount" >= 0 AND "trip_settlements"."agreed_freight_amount" >= 0 AND "trip_settlements"."transporter_paid_amount" >= 0 AND "trip_settlements"."billed_amount" >= 0 AND "trip_settlements"."company_received_amount" >= 0);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_freight_nonnegative" CHECK ("trips"."agreed_freight_amount" IS NULL OR "trips"."agreed_freight_amount" >= 0);