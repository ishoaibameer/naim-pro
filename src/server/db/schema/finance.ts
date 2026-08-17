import { sql } from "drizzle-orm"
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import {
  MONEY_PRECISION,
  MONEY_SCALE,
  RATE_PRECISION,
  RATE_SCALE,
  WEIGHT_PRECISION,
  WEIGHT_SCALE,
} from "./constants"
import {
  billStatusEnum,
  paymentDirectionEnum,
  paymentModeEnum,
  paymentStatusEnum,
  paymentTypeEnum,
} from "./enums"
import { memberships, organizations } from "./identity"
import { deals, trips } from "./operations"
import { companies, transporters, vendors } from "./parties"

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    companyId: uuid("company_id").notNull(),
    billNumber: varchar("bill_number", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 80 }),
    billDate: date("bill_date").notNull(),
    status: billStatusEnum("status").default("DRAFT").notNull(),
    totalAmount: numeric("total_amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    notes: text("notes"),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedByMembershipId: uuid("issued_by_membership_id"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByMembershipId: uuid("voided_by_membership_id"),
    voidReason: text("void_reason"),
    replacementForBillId: uuid("replacement_for_bill_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("bills_organization_id_unique").on(table.organizationId, table.id),
    unique("bills_org_number_unique").on(
      table.organizationId,
      table.billNumber
    ),
    uniqueIndex("bills_org_idempotency_unique")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    foreignKey({
      columns: [table.organizationId, table.companyId],
      foreignColumns: [companies.organizationId, companies.id],
      name: "bills_company_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "bills_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "bills_updated_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.issuedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "bills_issued_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.voidedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "bills_voided_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.replacementForBillId],
      foreignColumns: [table.organizationId, table.id],
      name: "bills_replacement_fk",
    }),
    index("bills_org_company_status_idx").on(
      table.organizationId,
      table.companyId,
      table.status
    ),
    check("bills_total_nonnegative", sql`${table.totalAmount} >= 0`),
    check("bills_currency_inr", sql`${table.currency} = 'INR'`),
    check("bills_version_positive", sql`${table.version} > 0`),
  ]
)

export const billLines = pgTable(
  "bill_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    billId: uuid("bill_id").notNull(),
    tripId: uuid("trip_id").notNull(),
    description: text("description").notNull(),
    quantityMt: numeric("quantity_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }).notNull(),
    rate: numeric("rate", {
      precision: RATE_PRECISION,
      scale: RATE_SCALE,
    }).notNull(),
    lineAmount: numeric("line_amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (table) => [
    unique("bill_lines_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.billId],
      foreignColumns: [bills.organizationId, bills.id],
      name: "bill_lines_bill_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "bill_lines_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "bill_lines_created_by_fk",
    }),
    uniqueIndex("bill_lines_active_trip_unique")
      .on(table.organizationId, table.tripId)
      .where(sql`${table.voidedAt} IS NULL`),
    index("bill_lines_bill_idx").on(table.organizationId, table.billId),
    check("bill_lines_quantity_positive", sql`${table.quantityMt} > 0`),
    check("bill_lines_rate_nonnegative", sql`${table.rate} >= 0`),
    check("bill_lines_amount_nonnegative", sql`${table.lineAmount} >= 0`),
  ]
)

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentNumber: varchar("payment_number", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 80 }),
    direction: paymentDirectionEnum("direction").notNull(),
    type: paymentTypeEnum("type").notNull(),
    status: paymentStatusEnum("status").default("DRAFT").notNull(),
    vendorId: uuid("vendor_id"),
    transporterId: uuid("transporter_id"),
    companyId: uuid("company_id"),
    amount: numeric("amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    receiptNumber: varchar("receipt_number", { length: 100 }),
    normalizedReceiptNumber: varchar("normalized_receipt_number", {
      length: 100,
    }),
    notes: text("notes"),
    recordedByMembershipId: uuid("recorded_by_membership_id").notNull(),
    paidByMembershipId: uuid("paid_by_membership_id"),
    reversalOfPaymentId: uuid("reversal_of_payment_id"),
    reversalReason: text("reversal_reason"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("payments_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("payments_org_number_unique").on(
      table.organizationId,
      table.paymentNumber
    ),
    uniqueIndex("payments_org_idempotency_unique")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    foreignKey({
      columns: [table.organizationId, table.vendorId],
      foreignColumns: [vendors.organizationId, vendors.id],
      name: "payments_vendor_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.transporterId],
      foreignColumns: [transporters.organizationId, transporters.id],
      name: "payments_transporter_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.companyId],
      foreignColumns: [companies.organizationId, companies.id],
      name: "payments_company_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.recordedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "payments_recorded_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.paidByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "payments_paid_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.reversalOfPaymentId],
      foreignColumns: [table.organizationId, table.id],
      name: "payments_reversal_fk",
    }),
    uniqueIndex("payments_reversal_of_unique")
      .on(table.organizationId, table.reversalOfPaymentId)
      .where(sql`${table.reversalOfPaymentId} IS NOT NULL`),
    index("payments_org_status_date_idx").on(
      table.organizationId,
      table.status,
      table.paymentDate
    ),
    index("payments_org_date_idx").on(table.organizationId, table.paymentDate),
    index("payments_org_vendor_idx").on(table.organizationId, table.vendorId),
    index("payments_org_transporter_idx").on(
      table.organizationId,
      table.transporterId
    ),
    index("payments_org_company_idx").on(table.organizationId, table.companyId),
    index("payments_org_receipt_idx").on(
      table.organizationId,
      table.normalizedReceiptNumber
    ),
    check(
      "payments_exactly_one_counterparty",
      sql`num_nonnulls(${table.vendorId}, ${table.transporterId}, ${table.companyId}) = 1`
    ),
    check("payments_amount_positive", sql`${table.amount} > 0`),
    check("payments_currency_inr", sql`${table.currency} = 'INR'`),
    check(
      "payments_not_own_reversal",
      sql`${table.reversalOfPaymentId} IS NULL OR ${table.reversalOfPaymentId} <> ${table.id}`
    ),
    check(
      "payments_reversal_reason_required",
      sql`${table.reversalOfPaymentId} IS NULL OR ${table.reversalReason} IS NOT NULL`
    ),
    check(
      "payments_status_timestamps",
      sql`(${table.status} = 'DRAFT' AND ${table.postedAt} IS NULL AND ${table.reversedAt} IS NULL) OR (${table.status} = 'POSTED' AND ${table.postedAt} IS NOT NULL AND ${table.reversedAt} IS NULL) OR (${table.status} = 'REVERSED' AND ${table.postedAt} IS NOT NULL AND ${table.reversedAt} IS NOT NULL)`
    ),
    check("payments_version_positive", sql`${table.version} > 0`),
  ]
)

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id").notNull(),
    dealId: uuid("deal_id"),
    tripId: uuid("trip_id"),
    billId: uuid("bill_id"),
    amount: numeric("amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    allocatedByMembershipId: uuid("allocated_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.paymentId],
      foreignColumns: [payments.organizationId, payments.id],
      name: "payment_allocations_payment_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.dealId],
      foreignColumns: [deals.organizationId, deals.id],
      name: "payment_allocations_deal_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "payment_allocations_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.billId],
      foreignColumns: [bills.organizationId, bills.id],
      name: "payment_allocations_bill_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.allocatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "payment_allocations_actor_fk",
    }),
    index("payment_allocations_payment_idx").on(
      table.organizationId,
      table.paymentId
    ),
    index("payment_allocations_deal_idx").on(
      table.organizationId,
      table.dealId
    ),
    index("payment_allocations_trip_idx").on(
      table.organizationId,
      table.tripId
    ),
    index("payment_allocations_bill_idx").on(
      table.organizationId,
      table.billId
    ),
    check(
      "payment_allocations_exactly_one_target",
      sql`num_nonnulls(${table.dealId}, ${table.tripId}, ${table.billId}) = 1`
    ),
    check("payment_allocations_amount_positive", sql`${table.amount} > 0`),
  ]
)
