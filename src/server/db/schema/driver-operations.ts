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

import { MONEY_PRECISION, MONEY_SCALE } from "./constants"
import { documents } from "./documents"
import {
  driverCheckInTypeEnum,
  driverExpenseStatusEnum,
  driverExpenseTypeEnum,
} from "./enums"
import { memberships, organizations } from "./identity"
import { trips } from "./operations"
import { drivers } from "./parties"

export const driverCheckIns = pgTable(
  "driver_check_ins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripId: uuid("trip_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    type: driverCheckInTypeEnum("type").notNull(),
    note: text("note"),
    locationText: varchar("location_text", { length: 240 }),
    actorMembershipId: uuid("actor_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("driver_check_ins_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "driver_check_ins_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "driver_check_ins_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.actorMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "driver_check_ins_actor_fk",
    }),
    uniqueIndex("driver_check_ins_trip_driver_type_unique").on(
      table.organizationId,
      table.tripId,
      table.driverId,
      table.type
    ),
    index("driver_check_ins_trip_created_idx").on(
      table.organizationId,
      table.tripId,
      table.createdAt
    ),
  ]
)

export const driverExpenses = pgTable(
  "driver_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripId: uuid("trip_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    type: driverExpenseTypeEnum("type").notNull(),
    amount: numeric("amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    expenseDate: date("expense_date").notNull(),
    note: text("note"),
    status: driverExpenseStatusEnum("status").default("PENDING").notNull(),
    receiptDocumentId: uuid("receipt_document_id"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    reviewedByMembershipId: uuid("reviewed_by_membership_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("driver_expenses_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "driver_expenses_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "driver_expenses_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.receiptDocumentId],
      foreignColumns: [documents.organizationId, documents.id],
      name: "driver_expenses_receipt_document_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "driver_expenses_creator_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.reviewedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "driver_expenses_reviewer_fk",
    }),
    index("driver_expenses_driver_date_idx").on(
      table.organizationId,
      table.driverId,
      table.expenseDate
    ),
    index("driver_expenses_trip_status_idx").on(
      table.organizationId,
      table.tripId,
      table.status
    ),
    check("driver_expenses_amount_positive", sql`${table.amount} > 0`),
    check("driver_expenses_version_positive", sql`${table.version} > 0`),
    check(
      "driver_expenses_review_consistent",
      sql`(${table.status} = 'PENDING' AND ${table.reviewedByMembershipId} IS NULL AND ${table.reviewedAt} IS NULL) OR (${table.status} IN ('APPROVED', 'REJECTED') AND ${table.reviewedByMembershipId} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL)`
    ),
  ]
)
