import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { documentTypeEnum, recordStatusEnum } from "./enums"
import { bills, payments } from "./finance"
import { memberships, organizations } from "./identity"
import { deals, trips } from "./operations"
import { drivers, vehicles, vendors } from "./parties"

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    documentType: documentTypeEnum("document_type").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    profileKey: varchar("profile_key", { length: 160 }),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    currentVersionNumber: integer("current_version_number")
      .default(1)
      .notNull(),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    retiredByMembershipId: uuid("retired_by_membership_id"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredReason: text("retired_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("documents_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "documents_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.retiredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "documents_retired_by_fk",
    }),
    index("documents_org_type_created_idx").on(
      table.organizationId,
      table.documentType,
      table.createdAt
    ),
    index("documents_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
    uniqueIndex("documents_org_profile_key_unique")
      .on(table.organizationId, table.profileKey)
      .where(sql`${table.profileKey} IS NOT NULL`),
    check(
      "documents_current_version_positive",
      sql`${table.currentVersionNumber} > 0`
    ),
    check("documents_version_positive", sql`${table.version} > 0`),
    check(
      "documents_profile_key_type",
      sql`${table.profileKey} IS NULL OR ${table.documentType} = 'VEHICLE_PHOTO'`
    ),
    check(
      "documents_retirement_consistent",
      sql`(${table.status} = 'ACTIVE' AND ${table.retiredAt} IS NULL AND ${table.retiredByMembershipId} IS NULL AND ${table.retiredReason} IS NULL) OR (${table.status} = 'INACTIVE' AND ${table.retiredAt} IS NOT NULL AND ${table.retiredByMembershipId} IS NOT NULL AND ${table.retiredReason} IS NOT NULL)`
    ),
  ]
)

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    storageKey: varchar("storage_key", { length: 320 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    uploadedByMembershipId: uuid("uploaded_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("document_versions_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.documentId],
      foreignColumns: [documents.organizationId, documents.id],
      name: "document_versions_document_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.uploadedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "document_versions_uploaded_by_fk",
    }),
    unique("document_versions_number_unique").on(
      table.organizationId,
      table.documentId,
      table.versionNumber
    ),
    unique("document_versions_storage_key_unique").on(table.storageKey),
    index("document_versions_checksum_idx").on(
      table.organizationId,
      table.checksumSha256
    ),
    check("document_versions_number_positive", sql`${table.versionNumber} > 0`),
    check("document_versions_size_positive", sql`${table.sizeBytes} > 0`),
    check(
      "document_versions_size_limited",
      sql`${table.sizeBytes} <= 15728640`
    ),
    check(
      "document_versions_mime_allowed",
      sql`${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')`
    ),
    check(
      "document_versions_checksum_valid",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`
    ),
  ]
)

export const documentAttachments = pgTable(
  "document_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    documentId: uuid("document_id").notNull(),
    dealId: uuid("deal_id"),
    tripId: uuid("trip_id"),
    paymentId: uuid("payment_id"),
    billId: uuid("bill_id"),
    vehicleId: uuid("vehicle_id"),
    vendorId: uuid("vendor_id"),
    driverId: uuid("driver_id"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.documentId],
      foreignColumns: [documents.organizationId, documents.id],
      name: "document_attachments_document_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.dealId],
      foreignColumns: [deals.organizationId, deals.id],
      name: "document_attachments_deal_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "document_attachments_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.paymentId],
      foreignColumns: [payments.organizationId, payments.id],
      name: "document_attachments_payment_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.billId],
      foreignColumns: [bills.organizationId, bills.id],
      name: "document_attachments_bill_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.vehicleId],
      foreignColumns: [vehicles.organizationId, vehicles.id],
      name: "document_attachments_vehicle_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.vendorId],
      foreignColumns: [vendors.organizationId, vendors.id],
      name: "document_attachments_vendor_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "document_attachments_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "document_attachments_created_by_fk",
    }),
    uniqueIndex("document_attachments_document_target_unique").on(
      table.organizationId,
      table.documentId,
      table.dealId,
      table.tripId,
      table.paymentId,
      table.billId,
      table.vehicleId,
      table.vendorId,
      table.driverId
    ),
    index("document_attachments_deal_idx").on(
      table.organizationId,
      table.dealId
    ),
    index("document_attachments_trip_idx").on(
      table.organizationId,
      table.tripId
    ),
    index("document_attachments_payment_idx").on(
      table.organizationId,
      table.paymentId
    ),
    index("document_attachments_bill_idx").on(
      table.organizationId,
      table.billId
    ),
    index("document_attachments_vehicle_idx").on(
      table.organizationId,
      table.vehicleId
    ),
    index("document_attachments_vendor_idx").on(
      table.organizationId,
      table.vendorId
    ),
    index("document_attachments_driver_idx").on(
      table.organizationId,
      table.driverId
    ),
    check(
      "document_attachments_exactly_one_target",
      sql`num_nonnulls(${table.dealId}, ${table.tripId}, ${table.paymentId}, ${table.billId}, ${table.vehicleId}, ${table.vendorId}, ${table.driverId}) = 1`
    ),
  ]
)
