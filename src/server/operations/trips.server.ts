import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { z } from "zod"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  activityEvents,
  companies,
  deals,
  drivers,
  driverTransporterAssignments,
  locations,
  memberships,
  transporters,
  tripAssignments,
  trips,
  users,
  vehicleTransporterAssignments,
  vehicles,
  vendors,
} from "@/server/db/schema"
import type {
  cancelTripSchema,
  confirmDeliverySchema,
  confirmLoadingSchema,
  createTripSchema,
  tripListSchema,
  tripMutationSchema,
} from "./schemas"
import { calculateWeightReconciliation } from "./decimal"
import {
  assertTripTransition,
  canCancelTrip,
  TripConcurrencyError,
} from "./trip-state"
import type { TripStatus } from "./trip-state"
import {
  normalizeReference,
  recordOperationalMutation,
  recordTripStatus,
  requireOperationsActor,
} from "./shared.server"
import type { OperationsTransaction } from "./shared.server"

type TripListInput = z.infer<typeof tripListSchema>
type CreateTripInput = z.infer<typeof createTripSchema>
type TripMutationInput = z.infer<typeof tripMutationSchema>
type LoadingInput = z.infer<typeof confirmLoadingSchema>
type DeliveryInput = z.infer<typeof confirmDeliverySchema>
type CancelInput = z.infer<typeof cancelTripSchema>

const pickupLocations = alias(locations, "trip_pickup_locations")
const destinationLocations = alias(locations, "trip_destination_locations")
const ownerMemberships = alias(memberships, "trip_owner_memberships")
const ownerUsers = alias(users, "trip_owner_users")

function listWhere(organizationId: string, input: TripListInput, id?: string) {
  const from = input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined
  const to = input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined
  const tabCondition = id
    ? undefined
    : input.tab === "ACTIVE"
      ? notInArray(trips.status, [
          "DELIVERED",
          "SETTLED",
          "ARCHIVED",
          "CANCELLED",
        ])
      : input.tab === "COMPLETED"
        ? inArray(trips.status, ["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"])
        : inArray(trips.status, ["ARCHIVED", "CANCELLED"])
  const search = input.search.trim()
  return and(
    eq(trips.organizationId, organizationId),
    id ? eq(trips.id, id) : undefined,
    tabCondition,
    input.status === "ALL" ? undefined : eq(trips.status, input.status),
    input.vendorId ? eq(deals.vendorId, input.vendorId) : undefined,
    input.vehicleId ? eq(trips.currentVehicleId, input.vehicleId) : undefined,
    input.driverId ? eq(trips.currentDriverId, input.driverId) : undefined,
    input.pickupLocationId
      ? eq(trips.pickupLocationId, input.pickupLocationId)
      : undefined,
    input.destinationLocationId
      ? eq(trips.destinationLocationId, input.destinationLocationId)
      : undefined,
    input.transporterId
      ? eq(trips.currentTransporterId, input.transporterId)
      : undefined,
    input.companyId
      ? eq(trips.destinationCompanyId, input.companyId)
      : undefined,
    input.ownerMembershipId
      ? eq(trips.ownerMembershipId, input.ownerMembershipId)
      : undefined,
    from ? gte(trips.createdAt, from) : undefined,
    to ? lte(trips.createdAt, to) : undefined,
    search
      ? or(
          ilike(trips.tripNumber, `%${search}%`),
          ilike(vehicles.registrationNumber, `%${search}%`),
          ilike(drivers.name, `%${search}%`),
          ilike(drivers.phoneE164, `%${search}%`),
          ilike(vendors.name, `%${search}%`),
          ilike(transporters.name, `%${search}%`),
          ilike(companies.name, `%${search}%`),
          ilike(pickupLocations.name, `%${search}%`),
          ilike(destinationLocations.name, `%${search}%`),
          ilike(trips.challanNumber, `%${search}%`),
          ilike(trips.weighmentCardNumber, `%${search}%`)
        )
      : undefined
  )
}

function tripListQuery(
  db: ReturnType<typeof getDatabase>,
  organizationId: string,
  input: TripListInput,
  id?: string
) {
  return db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      dealId: trips.dealId,
      dealNumber: deals.dealNumber,
      status: trips.status,
      vehicle: vehicles.registrationNumber,
      driver: drivers.name,
      driverPhone: drivers.phoneE164,
      vendor: vendors.name,
      transporter: transporters.name,
      company: companies.name,
      pickup: pickupLocations.name,
      destination: destinationLocations.name,
      owner: ownerUsers.name,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
      challanNumber: trips.challanNumber,
      weighmentCardNumber: trips.weighmentCardNumber,
      dispatchedAt: trips.dispatchedAt,
      deliveredAt: trips.deliveredAt,
      createdAt: trips.createdAt,
      version: trips.version,
    })
    .from(trips)
    .innerJoin(
      deals,
      and(
        eq(deals.organizationId, trips.organizationId),
        eq(deals.id, trips.dealId)
      )
    )
    .innerJoin(
      vendors,
      and(
        eq(vendors.organizationId, deals.organizationId),
        eq(vendors.id, deals.vendorId)
      )
    )
    .leftJoin(
      vehicles,
      and(
        eq(vehicles.organizationId, trips.organizationId),
        eq(vehicles.id, trips.currentVehicleId)
      )
    )
    .leftJoin(
      drivers,
      and(
        eq(drivers.organizationId, trips.organizationId),
        eq(drivers.id, trips.currentDriverId)
      )
    )
    .leftJoin(
      transporters,
      and(
        eq(transporters.organizationId, trips.organizationId),
        eq(transporters.id, trips.currentTransporterId)
      )
    )
    .innerJoin(
      companies,
      and(
        eq(companies.organizationId, trips.organizationId),
        eq(companies.id, trips.destinationCompanyId)
      )
    )
    .innerJoin(
      pickupLocations,
      and(
        eq(pickupLocations.organizationId, trips.organizationId),
        eq(pickupLocations.id, trips.pickupLocationId)
      )
    )
    .innerJoin(
      destinationLocations,
      and(
        eq(destinationLocations.organizationId, trips.organizationId),
        eq(destinationLocations.id, trips.destinationLocationId)
      )
    )
    .innerJoin(
      ownerMemberships,
      and(
        eq(ownerMemberships.organizationId, trips.organizationId),
        eq(ownerMemberships.id, trips.ownerMembershipId)
      )
    )
    .innerJoin(ownerUsers, eq(ownerUsers.id, ownerMemberships.userId))
    .where(listWhere(organizationId, input, id))
}

export async function listTrips(actor: SafeAuthContext, input: TripListInput) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const itemsQuery = tripListQuery(db, organizationId, input)
    .orderBy(desc(trips.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
  const countQuery = db
    .select({ value: count() })
    .from(trips)
    .innerJoin(
      deals,
      and(
        eq(deals.organizationId, trips.organizationId),
        eq(deals.id, trips.dealId)
      )
    )
    .innerJoin(
      vendors,
      and(
        eq(vendors.organizationId, deals.organizationId),
        eq(vendors.id, deals.vendorId)
      )
    )
    .leftJoin(
      vehicles,
      and(
        eq(vehicles.organizationId, trips.organizationId),
        eq(vehicles.id, trips.currentVehicleId)
      )
    )
    .leftJoin(
      drivers,
      and(
        eq(drivers.organizationId, trips.organizationId),
        eq(drivers.id, trips.currentDriverId)
      )
    )
    .leftJoin(
      transporters,
      and(
        eq(transporters.organizationId, trips.organizationId),
        eq(transporters.id, trips.currentTransporterId)
      )
    )
    .innerJoin(
      companies,
      and(
        eq(companies.organizationId, trips.organizationId),
        eq(companies.id, trips.destinationCompanyId)
      )
    )
    .innerJoin(
      pickupLocations,
      and(
        eq(pickupLocations.organizationId, trips.organizationId),
        eq(pickupLocations.id, trips.pickupLocationId)
      )
    )
    .innerJoin(
      destinationLocations,
      and(
        eq(destinationLocations.organizationId, trips.organizationId),
        eq(destinationLocations.id, trips.destinationLocationId)
      )
    )
    .innerJoin(
      ownerMemberships,
      and(
        eq(ownerMemberships.organizationId, trips.organizationId),
        eq(ownerMemberships.id, trips.ownerMembershipId)
      )
    )
    .innerJoin(ownerUsers, eq(ownerUsers.id, ownerMemberships.userId))
    .where(listWhere(organizationId, input))
  const [items, [total]] = await Promise.all([itemsQuery, countQuery])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

async function assertAssignmentMasters(
  tx: OperationsTransaction,
  organizationId: string,
  input: CreateTripInput
) {
  const [
    transporterRows,
    vehicleRows,
    driverRows,
    companyRows,
    destinationRows,
  ] = await Promise.all([
    tx
      .select({ id: transporters.id })
      .from(transporters)
      .where(
        and(
          eq(transporters.id, input.transporterId),
          eq(transporters.organizationId, organizationId),
          eq(transporters.status, "ACTIVE")
        )
      )
      .limit(1),
    tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, input.vehicleId),
          eq(vehicles.organizationId, organizationId),
          eq(vehicles.status, "ACTIVE")
        )
      )
      .limit(1),
    tx
      .select({ id: drivers.id })
      .from(drivers)
      .where(
        and(
          eq(drivers.id, input.driverId),
          eq(drivers.organizationId, organizationId),
          eq(drivers.status, "ACTIVE")
        )
      )
      .limit(1),
    tx
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, input.destinationCompanyId),
          eq(companies.organizationId, organizationId),
          eq(companies.status, "ACTIVE")
        )
      )
      .limit(1),
    tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, input.destinationLocationId),
          eq(locations.organizationId, organizationId),
          eq(locations.status, "ACTIVE")
        )
      )
      .limit(1),
  ])
  const transporter = transporterRows.at(0)
  const vehicle = vehicleRows.at(0)
  const driver = driverRows.at(0)
  const company = companyRows.at(0)
  const destination = destinationRows.at(0)
  if (!transporter || !vehicle || !driver || !company || !destination)
    throw new Error(
      "All Trip assignments must be active records in this organization."
    )
  const [driverLinkRows, vehicleLinkRows] = await Promise.all([
    tx
      .select({ transporterId: driverTransporterAssignments.transporterId })
      .from(driverTransporterAssignments)
      .where(
        and(
          eq(driverTransporterAssignments.organizationId, organizationId),
          eq(driverTransporterAssignments.driverId, input.driverId),
          sql`${driverTransporterAssignments.validTo} IS NULL`
        )
      )
      .limit(1),
    tx
      .select({ transporterId: vehicleTransporterAssignments.transporterId })
      .from(vehicleTransporterAssignments)
      .where(
        and(
          eq(vehicleTransporterAssignments.organizationId, organizationId),
          eq(vehicleTransporterAssignments.vehicleId, input.vehicleId),
          sql`${vehicleTransporterAssignments.validTo} IS NULL`
        )
      )
      .limit(1),
  ])
  const driverLink = driverLinkRows.at(0)
  const vehicleLink = vehicleLinkRows.at(0)
  if (driverLink && driverLink.transporterId !== input.transporterId)
    throw new Error("Driver is currently assigned to a different transporter.")
  if (vehicleLink && vehicleLink.transporterId !== input.transporterId)
    throw new Error("Vehicle is currently assigned to a different transporter.")
}

export async function createTrip(
  actor: SafeAuthContext,
  input: CreateTripInput
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const id = randomUUID()
  const tripNumber = `TR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`
  return db.transaction(async (tx) => {
    const deal = (
      await tx
        .select({
          id: deals.id,
          pickupLocationId: deals.pickupLocationId,
          ownerMembershipId: deals.ownerMembershipId,
          status: deals.status,
        })
        .from(deals)
        .where(
          and(
            eq(deals.organizationId, organizationId),
            eq(deals.id, input.dealId)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!deal || deal.status !== "ACTIVE")
      throw new Error(
        "Trip can only be created for an active Deal in this organization."
      )
    await assertAssignmentMasters(tx, organizationId, input)
    const [record] = await tx
      .insert(trips)
      .values({
        id,
        organizationId,
        tripNumber,
        dealId: input.dealId,
        destinationCompanyId: input.destinationCompanyId,
        pickupLocationId: deal.pickupLocationId,
        destinationLocationId: input.destinationLocationId,
        currentTransporterId: input.transporterId,
        currentDriverId: input.driverId,
        currentVehicleId: input.vehicleId,
        ownerMembershipId: deal.ownerMembershipId,
        status: "TRUCK_ASSIGNED",
        createdByMembershipId: actor.membership.id,
        updatedByMembershipId: actor.membership.id,
      })
      .returning()
    await tx.insert(tripAssignments).values({
      organizationId,
      tripId: id,
      transporterId: input.transporterId,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      changedByMembershipId: actor.membership.id,
      reason: "Initial truck assignment",
    })
    await recordTripStatus(tx, actor, {
      tripId: id,
      fromStatus: null,
      toStatus: "TRUCK_ASSIGNED",
    })
    await recordOperationalMutation(tx, actor, {
      action: "TRIP_ASSIGNED",
      message: `${actor.user.name} assigned a truck to Trip ${tripNumber}`,
      entityType: "TRIP",
      entityId: id,
      after: { tripNumber, status: "TRUCK_ASSIGNED", ...input },
    })
    return record
  })
}

async function lockedTrip(
  tx: OperationsTransaction,
  organizationId: string,
  input: TripMutationInput
) {
  const record = (
    await tx
      .select()
      .from(trips)
      .where(
        and(eq(trips.organizationId, organizationId), eq(trips.id, input.id))
      )
      .limit(1)
      .for("update")
  ).at(0)
  if (!record) throw new Error("Trip not found.")
  if (record.version !== input.version) throw new TripConcurrencyError()
  return record
}

async function changeStatus(
  tx: OperationsTransaction,
  actor: SafeAuthContext,
  record: typeof trips.$inferSelect,
  toStatus: TripStatus,
  values: Partial<typeof trips.$inferInsert>,
  event: {
    action: string
    message: string
    reason?: string | null
    metadata?: Record<string, unknown>
  }
) {
  assertTripTransition(record.status, toStatus)
  const updated = (
    await tx
      .update(trips)
      .set({
        ...values,
        status: toStatus,
        version: record.version + 1,
        updatedAt: new Date(),
        updatedByMembershipId: actor.membership.id,
      })
      .where(
        and(
          eq(trips.organizationId, record.organizationId),
          eq(trips.id, record.id),
          eq(trips.version, record.version),
          eq(trips.status, record.status)
        )
      )
      .returning()
  ).at(0)
  if (!updated) throw new TripConcurrencyError()
  await recordTripStatus(tx, actor, {
    tripId: record.id,
    fromStatus: record.status,
    toStatus,
    reason: event.reason,
  })
  await recordOperationalMutation(tx, actor, {
    action: event.action,
    message: event.message,
    entityType: "TRIP",
    entityId: record.id,
    before: { status: record.status, version: record.version },
    after: { status: toStatus, version: updated.version, ...values },
    reason: event.reason,
    metadata: event.metadata,
  })
  return updated
}

export async function startLoading(
  actor: SafeAuthContext,
  input: TripMutationInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const record = await lockedTrip(tx, organizationId, input)
    return changeStatus(
      tx,
      actor,
      record,
      "LOADING",
      {},
      {
        action: "TRIP_LOADING_STARTED",
        message: `${actor.user.name} started loading Trip ${record.tripNumber}`,
      }
    )
  })
}

export async function confirmLoading(
  actor: SafeAuthContext,
  input: LoadingInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const record = await lockedTrip(tx, organizationId, input)
    return changeStatus(
      tx,
      actor,
      record,
      "LOADED",
      {
        loadedWeightMt: input.loadedWeightMt,
        challanNumber: input.challanNumber,
        normalizedChallanNumber: input.challanNumber
          ? normalizeReference(input.challanNumber)
          : null,
      },
      {
        action: "TRIP_LOADING_CONFIRMED",
        message: `${actor.user.name} confirmed ${input.loadedWeightMt} ton loaded on Trip ${record.tripNumber}`,
        metadata: { loadingNotes: input.notes },
      }
    )
  })
}

export async function startJourney(
  actor: SafeAuthContext,
  input: TripMutationInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const record = await lockedTrip(tx, organizationId, input)
    return changeStatus(
      tx,
      actor,
      record,
      "IN_TRANSIT",
      { dispatchedAt: new Date() },
      {
        action: "TRIP_JOURNEY_STARTED",
        message: `${actor.user.name} started the journey for Trip ${record.tripNumber}`,
      }
    )
  })
}

export async function confirmDelivery(
  actor: SafeAuthContext,
  input: DeliveryInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const record = await lockedTrip(tx, organizationId, input)
    if (!record.loadedWeightMt) throw new Error("Loaded weight is missing.")
    const weight = calculateWeightReconciliation(
      record.loadedWeightMt,
      input.finalWeightMt
    )
    const weightMetadata = { ...weight }
    const updated = await changeStatus(
      tx,
      actor,
      record,
      "DELIVERED",
      {
        challanNumber: input.challanNumber,
        normalizedChallanNumber: normalizeReference(input.challanNumber),
        finalWeightMt: input.finalWeightMt,
        weighmentCardNumber: input.weighmentCardNumber,
        normalizedWeighmentCardNumber: normalizeReference(
          input.weighmentCardNumber
        ),
        deliveredAt: new Date(),
      },
      {
        action: "TRIP_DELIVERED",
        message: `${actor.user.name} confirmed delivery for Trip ${record.tripNumber}`,
        metadata: weightMetadata,
      }
    )
    if (weight.hasWeightIssue)
      await recordOperationalMutation(tx, actor, {
        action: "TRIP_WEIGHT_ISSUE_DETECTED",
        message: `System detected ${weight.differencePercent}% weight difference on Trip ${record.tripNumber}`,
        entityType: "TRIP",
        entityId: record.id,
        after: weightMetadata,
      })
    return { ...updated, weight }
  })
}

export async function cancelTrip(actor: SafeAuthContext, input: CancelInput) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const record = await lockedTrip(tx, organizationId, input)
    if (!canCancelTrip(record.status))
      throw new Error("Only a pre-dispatch Trip can be cancelled.")
    return changeStatus(
      tx,
      actor,
      record,
      "CANCELLED",
      {},
      {
        action: "TRIP_CANCELLED",
        message: `${actor.user.name} cancelled Trip ${record.tripNumber}`,
        reason: input.reason,
      }
    )
  })
}

export async function getTrip(actor: SafeAuthContext, id: string) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const template: TripListInput = {
    tab: "ACTIVE",
    search: "",
    status: "ALL",
    page: 1,
    pageSize: 1,
  }
  const record = (
    await tripListQuery(db, organizationId, template, id).limit(1)
  ).at(0)
  if (!record) throw new Error("Trip not found.")
  const events = await db
    .select({
      id: activityEvents.id,
      message: activityEvents.message,
      eventType: activityEvents.eventType,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        eq(activityEvents.entityType, "TRIP"),
        eq(activityEvents.entityId, id)
      )
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(50)
  const weight =
    record.loadedWeightMt && record.finalWeightMt
      ? calculateWeightReconciliation(
          record.loadedWeightMt,
          record.finalWeightMt
        )
      : null
  return { ...record, events, weight }
}
