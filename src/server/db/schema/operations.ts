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

import {
  MONEY_PRECISION,
  MONEY_SCALE,
  PERCENTAGE_PRECISION,
  PERCENTAGE_SCALE,
  RATE_PRECISION,
  RATE_SCALE,
  WEIGHT_PRECISION,
  WEIGHT_SCALE,
} from "./constants"
import { dealStatusEnum, tripStatusEnum } from "./enums"
import { memberships, organizations } from "./identity"
import {
  companies,
  drivers,
  locations,
  materials,
  transporters,
  vehicles,
  vendors,
} from "./parties"

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    dealNumber: varchar("deal_number", { length: 48 }).notNull(),
    vendorId: uuid("vendor_id").notNull(),
    materialId: uuid("material_id").notNull(),
    pickupLocationId: uuid("pickup_location_id").notNull(),
    purchaseRate: numeric("purchase_rate", {
      precision: RATE_PRECISION,
      scale: RATE_SCALE,
    }).notNull(),
    expectedQuantityMt: numeric("expected_quantity_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }),
    ownerMembershipId: uuid("owner_membership_id").notNull(),
    status: dealStatusEnum("status").default("DRAFT").notNull(),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("deals_organization_id_unique").on(table.organizationId, table.id),
    unique("deals_org_number_unique").on(
      table.organizationId,
      table.dealNumber
    ),
    foreignKey({
      columns: [table.organizationId, table.vendorId],
      foreignColumns: [vendors.organizationId, vendors.id],
      name: "deals_vendor_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.materialId],
      foreignColumns: [materials.organizationId, materials.id],
      name: "deals_material_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.pickupLocationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "deals_pickup_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "deals_owner_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "deals_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "deals_updated_by_fk",
    }),
    index("deals_org_status_idx").on(table.organizationId, table.status),
    index("deals_org_vendor_idx").on(table.organizationId, table.vendorId),
    index("deals_org_owner_idx").on(
      table.organizationId,
      table.ownerMembershipId
    ),
    check("deals_rate_nonnegative", sql`${table.purchaseRate} >= 0`),
    check(
      "deals_expected_quantity_nonnegative",
      sql`${table.expectedQuantityMt} IS NULL OR ${table.expectedQuantityMt} >= 0`
    ),
    check("deals_version_positive", sql`${table.version} > 0`),
  ]
)

export const dealStatusEvents = pgTable(
  "deal_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    dealId: uuid("deal_id").notNull(),
    fromStatus: dealStatusEnum("from_status"),
    toStatus: dealStatusEnum("to_status").notNull(),
    changedByMembershipId: uuid("changed_by_membership_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.dealId],
      foreignColumns: [deals.organizationId, deals.id],
      name: "deal_status_events_deal_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.changedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "deal_status_events_actor_fk",
    }),
    index("deal_status_events_deal_created_idx").on(
      table.organizationId,
      table.dealId,
      table.createdAt
    ),
  ]
)

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripNumber: varchar("trip_number", { length: 48 }).notNull(),
    dealId: uuid("deal_id").notNull(),
    destinationCompanyId: uuid("destination_company_id").notNull(),
    pickupLocationId: uuid("pickup_location_id").notNull(),
    destinationLocationId: uuid("destination_location_id").notNull(),
    currentTransporterId: uuid("current_transporter_id"),
    currentDriverId: uuid("current_driver_id"),
    currentVehicleId: uuid("current_vehicle_id"),
    ownerMembershipId: uuid("owner_membership_id").notNull(),
    status: tripStatusEnum("status").default("CREATED").notNull(),
    loadedWeightMt: numeric("loaded_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }),
    finalWeightMt: numeric("final_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }),
    acceptedFinalWeightMt: numeric("accepted_final_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }),
    challanNumber: varchar("challan_number", { length: 80 }),
    normalizedChallanNumber: varchar("normalized_challan_number", {
      length: 80,
    }),
    weighmentCardNumber: varchar("weighment_card_number", { length: 80 }),
    normalizedWeighmentCardNumber: varchar("normalized_weighment_card_number", {
      length: 80,
    }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdByMembershipId: uuid("created_by_membership_id").notNull(),
    updatedByMembershipId: uuid("updated_by_membership_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("trips_organization_id_unique").on(table.organizationId, table.id),
    unique("trips_org_number_unique").on(
      table.organizationId,
      table.tripNumber
    ),
    foreignKey({
      columns: [table.organizationId, table.dealId],
      foreignColumns: [deals.organizationId, deals.id],
      name: "trips_deal_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.destinationCompanyId],
      foreignColumns: [companies.organizationId, companies.id],
      name: "trips_destination_company_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.pickupLocationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "trips_pickup_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.destinationLocationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "trips_destination_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.currentTransporterId],
      foreignColumns: [transporters.organizationId, transporters.id],
      name: "trips_current_transporter_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.currentDriverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "trips_current_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.currentVehicleId],
      foreignColumns: [vehicles.organizationId, vehicles.id],
      name: "trips_current_vehicle_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trips_owner_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.createdByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trips_created_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.updatedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trips_updated_by_fk",
    }),
    index("trips_org_status_idx").on(table.organizationId, table.status),
    index("trips_org_created_idx").on(table.organizationId, table.createdAt),
    index("trips_org_deal_idx").on(table.organizationId, table.dealId),
    index("trips_org_company_idx").on(
      table.organizationId,
      table.destinationCompanyId
    ),
    index("trips_org_driver_status_idx").on(
      table.organizationId,
      table.currentDriverId,
      table.status
    ),
    index("trips_org_vehicle_status_idx").on(
      table.organizationId,
      table.currentVehicleId,
      table.status
    ),
    index("trips_org_transporter_status_idx").on(
      table.organizationId,
      table.currentTransporterId,
      table.status
    ),
    index("trips_org_challan_idx").on(
      table.organizationId,
      table.normalizedChallanNumber
    ),
    index("trips_org_weighment_card_idx").on(
      table.organizationId,
      table.normalizedWeighmentCardNumber
    ),
    check(
      "trips_loaded_weight_nonnegative",
      sql`${table.loadedWeightMt} IS NULL OR ${table.loadedWeightMt} >= 0`
    ),
    check(
      "trips_final_weight_nonnegative",
      sql`${table.finalWeightMt} IS NULL OR ${table.finalWeightMt} >= 0`
    ),
    check(
      "trips_accepted_weight_nonnegative",
      sql`${table.acceptedFinalWeightMt} IS NULL OR ${table.acceptedFinalWeightMt} >= 0`
    ),
    check(
      "trips_delivery_after_dispatch",
      sql`${table.dispatchedAt} IS NULL OR ${table.deliveredAt} IS NULL OR ${table.deliveredAt} >= ${table.dispatchedAt}`
    ),
    check(
      "trips_assignment_required_by_stage",
      sql`${table.status} NOT IN ('TRUCK_ASSIGNED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR (${table.currentTransporterId} IS NOT NULL AND ${table.currentDriverId} IS NOT NULL AND ${table.currentVehicleId} IS NOT NULL)`
    ),
    check(
      "trips_loaded_data_required_by_stage",
      sql`${table.status} NOT IN ('LOADED', 'IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR ${table.loadedWeightMt} > 0`
    ),
    check(
      "trips_dispatch_data_required_by_stage",
      sql`${table.status} NOT IN ('IN_TRANSIT', 'DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR ${table.dispatchedAt} IS NOT NULL`
    ),
    check(
      "trips_delivery_data_required_by_stage",
      sql`${table.status} NOT IN ('DELIVERED', 'SETTLEMENT_PENDING', 'SETTLED') OR (${table.finalWeightMt} IS NOT NULL AND ${table.challanNumber} IS NOT NULL AND ${table.weighmentCardNumber} IS NOT NULL AND ${table.deliveredAt} IS NOT NULL)`
    ),
    check(
      "trips_accepted_weight_required_by_stage",
      sql`${table.status} NOT IN ('SETTLEMENT_PENDING', 'SETTLED') OR ${table.acceptedFinalWeightMt} IS NOT NULL`
    ),
    check("trips_version_positive", sql`${table.version} > 0`),
  ]
)

export const tripAssignments = pgTable(
  "trip_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripId: uuid("trip_id").notNull(),
    transporterId: uuid("transporter_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    vehicleId: uuid("vehicle_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    changedByMembershipId: uuid("changed_by_membership_id").notNull(),
    reason: text("reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "trip_assignments_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.transporterId],
      foreignColumns: [transporters.organizationId, transporters.id],
      name: "trip_assignments_transporter_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.driverId],
      foreignColumns: [drivers.organizationId, drivers.id],
      name: "trip_assignments_driver_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.vehicleId],
      foreignColumns: [vehicles.organizationId, vehicles.id],
      name: "trip_assignments_vehicle_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.changedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trip_assignments_actor_fk",
    }),
    uniqueIndex("trip_assignments_open_trip_unique")
      .on(table.organizationId, table.tripId)
      .where(sql`${table.endedAt} IS NULL`),
    index("trip_assignments_driver_period_idx").on(
      table.organizationId,
      table.driverId,
      table.assignedAt,
      table.endedAt
    ),
    index("trip_assignments_vehicle_period_idx").on(
      table.organizationId,
      table.vehicleId,
      table.assignedAt,
      table.endedAt
    ),
    check(
      "trip_assignments_period_valid",
      sql`${table.endedAt} IS NULL OR ${table.endedAt} > ${table.assignedAt}`
    ),
  ]
)

export const tripStatusEvents = pgTable(
  "trip_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripId: uuid("trip_id").notNull(),
    fromStatus: tripStatusEnum("from_status"),
    toStatus: tripStatusEnum("to_status").notNull(),
    changedByMembershipId: uuid("changed_by_membership_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "trip_status_events_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.changedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trip_status_events_actor_fk",
    }),
    index("trip_status_events_trip_created_idx").on(
      table.organizationId,
      table.tripId,
      table.createdAt
    ),
  ]
)

export const tripSettlements = pgTable(
  "trip_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    tripId: uuid("trip_id").notNull(),
    loadedWeightMt: numeric("loaded_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }).notNull(),
    finalWeightMt: numeric("final_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }).notNull(),
    acceptedFinalWeightMt: numeric("accepted_final_weight_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }).notNull(),
    purchaseRate: numeric("purchase_rate", {
      precision: RATE_PRECISION,
      scale: RATE_SCALE,
    }).notNull(),
    weightDifferenceMt: numeric("weight_difference_mt", {
      precision: WEIGHT_PRECISION,
      scale: WEIGHT_SCALE,
    }).notNull(),
    weightDifferencePercent: numeric("weight_difference_percent", {
      precision: PERCENTAGE_PRECISION,
      scale: PERCENTAGE_SCALE,
    }),
    purchaseAmount: numeric("purchase_amount", {
      precision: MONEY_PRECISION,
      scale: MONEY_SCALE,
    }).notNull(),
    sourceTripVersion: integer("source_trip_version").notNull(),
    postedByMembershipId: uuid("posted_by_membership_id").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedByMembershipId: uuid("reversed_by_membership_id"),
    reversalReason: text("reversal_reason"),
    replacementForSettlementId: uuid("replacement_for_settlement_id"),
  },
  (table) => [
    unique("trip_settlements_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.tripId],
      foreignColumns: [trips.organizationId, trips.id],
      name: "trip_settlements_trip_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.postedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trip_settlements_posted_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.reversedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
      name: "trip_settlements_reversed_by_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.replacementForSettlementId],
      foreignColumns: [table.organizationId, table.id],
      name: "trip_settlements_replacement_fk",
    }),
    uniqueIndex("trip_settlements_active_trip_unique")
      .on(table.organizationId, table.tripId)
      .where(sql`${table.reversedAt} IS NULL`),
    check(
      "trip_settlements_weights_nonnegative",
      sql`${table.loadedWeightMt} >= 0 AND ${table.finalWeightMt} >= 0 AND ${table.acceptedFinalWeightMt} >= 0`
    ),
    check("trip_settlements_rate_nonnegative", sql`${table.purchaseRate} >= 0`),
    check(
      "trip_settlements_amount_nonnegative",
      sql`${table.purchaseAmount} >= 0`
    ),
    check(
      "trip_settlements_source_version_positive",
      sql`${table.sourceTripVersion} > 0`
    ),
    check(
      "trip_settlements_reversal_complete",
      sql`(${table.reversedAt} IS NULL AND ${table.reversedByMembershipId} IS NULL AND ${table.reversalReason} IS NULL) OR (${table.reversedAt} IS NOT NULL AND ${table.reversedByMembershipId} IS NOT NULL AND ${table.reversalReason} IS NOT NULL)`
    ),
  ]
)
