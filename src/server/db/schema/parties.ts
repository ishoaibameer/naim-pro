import { sql } from "drizzle-orm"
import {
  check,
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

import { memberships, organizations } from "./identity"
import { recordStatusEnum } from "./enums"

function lifecycleColumns() {
  return {
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
}

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    userId: uuid("user_id"),
    phoneE164: varchar("phone_e164", { length: 16 }),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("vendors_organization_id_unique").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.userId],
      foreignColumns: [memberships.organizationId, memberships.userId],
      name: "vendors_membership_user_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "vendors_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "vendors_updated_by_fk",
    }),
    uniqueIndex("vendors_org_user_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    index("vendors_org_name_idx").on(
      table.organizationId,
      table.normalizedName
    ),
    check("vendors_version_positive", sql`${table.version} > 0`),
  ]
)

export const transporters = pgTable(
  "transporters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 16 }),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("transporters_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "transporters_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "transporters_updated_by_fk",
    }),
    index("transporters_org_name_idx").on(
      table.organizationId,
      table.normalizedName
    ),
    check("transporters_version_positive", sql`${table.version} > 0`),
  ]
)

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 16 }),
    userId: uuid("user_id"),
    licenseNumber: varchar("license_number", { length: 80 }),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("drivers_organization_id_unique").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.userId],
      foreignColumns: [memberships.organizationId, memberships.userId],
      name: "drivers_membership_user_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "drivers_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "drivers_updated_by_fk",
    }),
    uniqueIndex("drivers_org_user_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("drivers_org_phone_unique")
      .on(table.organizationId, table.phoneE164)
      .where(sql`${table.phoneE164} IS NOT NULL`),
    index("drivers_org_name_idx").on(
      table.organizationId,
      table.normalizedName
    ),
    check("drivers_version_positive", sql`${table.version} > 0`),
  ]
)

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    registrationNumber: varchar("registration_number", {
      length: 32,
    }).notNull(),
    normalizedRegistrationNumber: varchar("normalized_registration_number", {
      length: 32,
    }).notNull(),
    vehicleType: varchar("vehicle_type", { length: 80 }),
    capacityMt: numeric("capacity_mt", { precision: 12, scale: 3 }),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("vehicles_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("vehicles_org_registration_unique").on(
      table.organizationId,
      table.normalizedRegistrationNumber
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "vehicles_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "vehicles_updated_by_fk",
    }),
    check(
      "vehicles_capacity_nonnegative",
      sql`${table.capacityMt} IS NULL OR ${table.capacityMt} >= 0`
    ),
    check("vehicles_version_positive", sql`${table.version} > 0`),
  ]
)

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 16 }),
    billingAddress: text("billing_address"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("companies_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "companies_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "companies_updated_by_fk",
    }),
    index("companies_org_name_idx").on(
      table.organizationId,
      table.normalizedName
    ),
    check("companies_version_positive", sql`${table.version} > 0`),
  ]
)

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 160 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 160 }).notNull(),
    description: text("description"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("materials_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("materials_org_name_unique").on(
      table.organizationId,
      table.normalizedName
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "materials_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "materials_updated_by_fk",
    }),
    check("materials_version_positive", sql`${table.version} > 0`),
  ]
)

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    ...lifecycleColumns(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("locations_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "locations_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "locations_updated_by_fk",
    }),
    index("locations_org_name_idx").on(
      table.organizationId,
      table.normalizedName
    ),
    check(
      "locations_latitude_range",
      sql`${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90`
    ),
    check(
      "locations_longitude_range",
      sql`${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180`
    ),
    check("locations_version_positive", sql`${table.version} > 0`),
  ]
)

export const driverTransporterAssignments = pgTable(
  "driver_transporter_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    driverId: uuid("driver_id").notNull(),
    transporterId: uuid("transporter_id").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    changedByMembershipId: uuid("changed_by_membership_id").notNull(),
    reason: text("reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "driver_transporter_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.transporterId],
      foreignColumns: [transporters.organizationId, transporters.id],
      name: "driver_transporter_transporter_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.changedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "driver_transporter_actor_fk",
    }),
    uniqueIndex("driver_transporter_open_unique")
      .on(table.organizationId, table.driverId)
      .where(sql`${table.validTo} IS NULL`),
    index("driver_transporter_transporter_idx").on(
      table.organizationId,
      table.transporterId,
      table.validTo
    ),
    check(
      "driver_transporter_period_valid",
      sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`
    ),
  ]
)

export const vehicleTransporterAssignments = pgTable(
  "vehicle_transporter_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    vehicleId: uuid("vehicle_id").notNull(),
    transporterId: uuid("transporter_id").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    changedByMembershipId: uuid("changed_by_membership_id").notNull(),
    reason: text("reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.vehicleId],
      foreignColumns: [vehicles.organizationId, vehicles.id],
      name: "vehicle_transporter_vehicle_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.transporterId],
      foreignColumns: [transporters.organizationId, transporters.id],
      name: "vehicle_transporter_transporter_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.changedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "vehicle_transporter_actor_fk",
    }),
    uniqueIndex("vehicle_transporter_open_unique")
      .on(table.organizationId, table.vehicleId)
      .where(sql`${table.validTo} IS NULL`),
    index("vehicle_transporter_transporter_idx").on(
      table.organizationId,
      table.transporterId,
      table.validTo
    ),
    check(
      "vehicle_transporter_period_valid",
      sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`
    ),
  ]
)
