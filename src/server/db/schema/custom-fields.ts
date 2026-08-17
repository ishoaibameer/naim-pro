import { sql } from "drizzle-orm"
import {
  check,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import type {
  CustomFieldRole,
  CustomFieldValidationConfig,
} from "@/server/custom-fields/config"
import {
  customFieldTargetEnum,
  customFieldTypeEnum,
  recordStatusEnum,
  roleEnum,
} from "./enums"
import { memberships, organizations } from "./identity"
import { deals, trips } from "./operations"
import { drivers, vendors } from "./parties"
import { payments } from "./finance"

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    target: customFieldTargetEnum("target").notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    currentVersionNumber: integer("current_version_number")
      .default(1)
      .notNull(),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("custom_field_definitions_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("custom_field_definitions_org_target_key_unique").on(
      table.organizationId,
      table.target,
      table.key
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "custom_field_definitions_created_by_fk",
    }),
    index("custom_field_definitions_org_target_status_idx").on(
      table.organizationId,
      table.target,
      table.status
    ),
    check(
      "custom_field_definitions_key_format",
      sql`${table.key} ~ '^[a-z][a-z0-9_]{0,63}$'`
    ),
    check(
      "custom_field_definitions_current_version_positive",
      sql`${table.currentVersionNumber} > 0`
    ),
    check(
      "custom_field_definitions_version_positive",
      sql`${table.version} > 0`
    ),
  ]
)

export const customFieldVersions = pgTable(
  "custom_field_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    definitionId: uuid("definition_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    fieldType: customFieldTypeEnum("field_type").notNull(),
    sectionKey: varchar("section_key", { length: 64 }).notNull(),
    required: boolean("required").default(false).notNull(),
    requiredRoles: jsonb("required_roles")
      .$type<CustomFieldRole[]>()
      .default([])
      .notNull(),
    validation: jsonb("validation")
      .$type<CustomFieldValidationConfig>()
      .default({})
      .notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("custom_field_versions_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("custom_field_versions_definition_id_unique").on(
      table.organizationId,
      table.definitionId,
      table.id
    ),
    unique("custom_field_versions_number_unique").on(
      table.organizationId,
      table.definitionId,
      table.versionNumber
    ),
    foreignKey({
      columns: [table.organizationId, table.definitionId],
      foreignColumns: [
        customFieldDefinitions.organizationId,
        customFieldDefinitions.id,
      ],
      name: "custom_field_versions_definition_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "custom_field_versions_created_by_fk",
    }),
    index("custom_field_versions_definition_sort_idx").on(
      table.organizationId,
      table.definitionId,
      table.sortOrder
    ),
    check(
      "custom_field_versions_number_positive",
      sql`${table.versionNumber} > 0`
    ),
    check(
      "custom_field_versions_sort_nonnegative",
      sql`${table.sortOrder} >= 0`
    ),
  ]
)

export const customFieldOptions = pgTable(
  "custom_field_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fieldVersionId: uuid("field_version_id").notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.fieldVersionId],
      foreignColumns: [
        customFieldVersions.organizationId,
        customFieldVersions.id,
      ],
      name: "custom_field_options_version_fk",
    }),
    unique("custom_field_options_version_code_unique").on(
      table.organizationId,
      table.fieldVersionId,
      table.code
    ),
    index("custom_field_options_version_sort_idx").on(
      table.organizationId,
      table.fieldVersionId,
      table.sortOrder
    ),
    check(
      "custom_field_options_code_format",
      sql`${table.code} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`
    ),
  ]
)

export const customFieldVisibleRoles = pgTable(
  "custom_field_visible_roles",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fieldVersionId: uuid("field_version_id").notNull(),
    role: roleEnum("role").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.fieldVersionId, table.role],
    }),
    foreignKey({
      columns: [table.organizationId, table.fieldVersionId],
      foreignColumns: [
        customFieldVersions.organizationId,
        customFieldVersions.id,
      ],
      name: "custom_field_visible_roles_version_fk",
    }),
  ]
)

export const customFieldEditableRoles = pgTable(
  "custom_field_editable_roles",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fieldVersionId: uuid("field_version_id").notNull(),
    role: roleEnum("role").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.fieldVersionId, table.role],
    }),
    foreignKey({
      columns: [table.organizationId, table.fieldVersionId],
      foreignColumns: [
        customFieldVersions.organizationId,
        customFieldVersions.id,
      ],
      name: "custom_field_editable_roles_version_fk",
    }),
  ]
)

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    definitionId: uuid("definition_id").notNull(),
    definitionVersionId: uuid("definition_version_id").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    dealId: uuid("deal_id"),
    tripId: uuid("trip_id"),
    vendorId: uuid("vendor_id"),
    driverId: uuid("driver_id"),
    paymentId: uuid("payment_id"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("custom_field_values_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.definitionId],
      foreignColumns: [
        customFieldDefinitions.organizationId,
        customFieldDefinitions.id,
      ],
      name: "custom_field_values_definition_fk",
    }),
    foreignKey({
      columns: [
        table.organizationId,
        table.definitionId,
        table.definitionVersionId,
      ],
      foreignColumns: [
        customFieldVersions.organizationId,
        customFieldVersions.definitionId,
        customFieldVersions.id,
      ],
      name: "custom_field_values_definition_version_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.dealId],
      foreignColumns: [deals.organizationId, deals.id],
      name: "custom_field_values_deal_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "custom_field_values_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.vendorId],
      foreignColumns: [vendors.organizationId, vendors.id],
      name: "custom_field_values_vendor_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "custom_field_values_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.paymentId],
      foreignColumns: [payments.organizationId, payments.id],
      name: "custom_field_values_payment_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "custom_field_values_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "custom_field_values_updated_by_fk",
    }),
    uniqueIndex("custom_field_values_deal_unique")
      .on(table.organizationId, table.definitionId, table.dealId)
      .where(sql`${table.dealId} IS NOT NULL`),
    uniqueIndex("custom_field_values_trip_unique")
      .on(table.organizationId, table.definitionId, table.tripId)
      .where(sql`${table.tripId} IS NOT NULL`),
    uniqueIndex("custom_field_values_vendor_unique")
      .on(table.organizationId, table.definitionId, table.vendorId)
      .where(sql`${table.vendorId} IS NOT NULL`),
    uniqueIndex("custom_field_values_driver_unique")
      .on(table.organizationId, table.definitionId, table.driverId)
      .where(sql`${table.driverId} IS NOT NULL`),
    uniqueIndex("custom_field_values_payment_unique")
      .on(table.organizationId, table.definitionId, table.paymentId)
      .where(sql`${table.paymentId} IS NOT NULL`),
    index("custom_field_values_target_batch_idx").on(
      table.organizationId,
      table.dealId,
      table.tripId,
      table.vendorId,
      table.driverId,
      table.paymentId
    ),
    check(
      "custom_field_values_exactly_one_target",
      sql`num_nonnulls(${table.dealId}, ${table.tripId}, ${table.vendorId}, ${table.driverId}, ${table.paymentId}) = 1`
    ),
    check("custom_field_values_version_positive", sql`${table.version} > 0`),
  ]
)
