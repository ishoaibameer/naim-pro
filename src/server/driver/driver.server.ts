import "@tanstack/react-start/server-only"

import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { ForbiddenError, requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  companies,
  deals,
  documentAttachments,
  documents,
  documentVersions,
  driverCheckIns,
  driverExpenses,
  drivers,
  driverTransporterAssignments,
  locations,
  materials,
  memberships,
  transporters,
  tripAssignments,
  trips,
  tripStatusEvents,
  users,
  vehicles,
} from "@/server/db/schema"
import { startJourneyForDriver } from "@/server/operations/trips.server"
import {
  recordOperationalMutation,
  requireOperationsActor,
} from "@/server/operations/shared.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import type {
  AttachDriverExpenseReceiptInput,
  CreateDriverExpenseInput,
  DriverCheckInInput,
  DriverTripListInput,
  ReviewDriverExpenseInput,
} from "./schemas"
import { canDriverCheckIn, canReviewDriverExpense } from "./policy"

const pickupLocations = alias(locations, "driver_pickup_locations")
const destinationLocations = alias(locations, "driver_destination_locations")
const reviewerMemberships = alias(
  memberships,
  "driver_expense_reviewer_memberships"
)
const reviewerUsers = alias(users, "driver_expense_reviewer_users")

const ACTIVE_TRIP_STATUSES = [
  "TRUCK_ASSIGNED",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
] as const
const HISTORY_TRIP_STATUSES = [
  "DELIVERED",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "ARCHIVED",
] as const
const DRIVER_DOCUMENT_TYPES = [
  "LOADING_PHOTO",
  "WEIGHBRIDGE_SLIP",
  "DELIVERY_CHALLAN",
  "PERMIT",
  "OTHER",
] as const

type DriverTransaction = ReturnType<typeof getDatabase> | OperationsTransaction

export async function requireLinkedDriver(actor: SafeAuthContext) {
  requireRole(actor, ["DRIVER"])
  const organizationId = actor.membership.organizationId
  const driver = (
    await getDatabase()
      .select({
        id: drivers.id,
        name: drivers.name,
        phone: drivers.phoneE164,
        licenseNumber: drivers.licenseNumber,
        status: drivers.status,
        createdAt: drivers.createdAt,
        transporter: transporters.name,
      })
      .from(drivers)
      .leftJoin(
        driverTransporterAssignments,
        and(
          eq(
            driverTransporterAssignments.organizationId,
            drivers.organizationId
          ),
          eq(driverTransporterAssignments.driverId, drivers.id),
          isNull(driverTransporterAssignments.validTo)
        )
      )
      .leftJoin(
        transporters,
        and(
          eq(transporters.organizationId, drivers.organizationId),
          eq(transporters.id, driverTransporterAssignments.transporterId)
        )
      )
      .where(
        and(
          eq(drivers.organizationId, organizationId),
          eq(drivers.userId, actor.user.id),
          eq(drivers.status, "ACTIVE")
        )
      )
      .limit(1)
  ).at(0)
  if (!driver) throw new ForbiddenError()
  return driver
}

function assignmentExists(
  transaction: DriverTransaction,
  organizationId: string,
  driverId: string,
  current: boolean
) {
  return exists(
    transaction
      .select({ value: sql`1` })
      .from(tripAssignments)
      .where(
        and(
          eq(tripAssignments.organizationId, organizationId),
          eq(tripAssignments.tripId, trips.id),
          eq(tripAssignments.driverId, driverId),
          current ? isNull(tripAssignments.endedAt) : undefined
        )
      )
  )
}

function driverTripQuery(transaction: DriverTransaction) {
  return transaction
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      status: trips.status,
      version: trips.version,
      vehicle: vehicles.registrationNumber,
      material: materials.name,
      pickup: pickupLocations.name,
      pickupAddress: pickupLocations.address,
      destination: destinationLocations.name,
      destinationAddress: destinationLocations.address,
      company: companies.name,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
      challanNumber: trips.challanNumber,
      dispatchedAt: trips.dispatchedAt,
      deliveredAt: trips.deliveredAt,
      createdAt: trips.createdAt,
      currentDriverId: trips.currentDriverId,
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
      materials,
      and(
        eq(materials.organizationId, trips.organizationId),
        eq(materials.id, deals.materialId)
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
    .leftJoin(
      vehicles,
      and(
        eq(vehicles.organizationId, trips.organizationId),
        eq(vehicles.id, trips.currentVehicleId)
      )
    )
}

function activeAssignmentWhere(organizationId: string, driverId: string) {
  const db = getDatabase()
  return and(
    eq(trips.organizationId, organizationId),
    eq(trips.currentDriverId, driverId),
    inArray(trips.status, ACTIVE_TRIP_STATUSES),
    assignmentExists(db, organizationId, driverId, true)
  )
}

export async function getDriverHome(actor: SafeAuthContext) {
  const driver = await requireLinkedDriver(actor)
  const organizationId = actor.membership.organizationId
  const db = getDatabase()
  const [current, recent] = await Promise.all([
    driverTripQuery(db)
      .where(activeAssignmentWhere(organizationId, driver.id))
      .orderBy(desc(trips.updatedAt))
      .limit(1),
    driverTripQuery(db)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          inArray(trips.status, HISTORY_TRIP_STATUSES),
          assignmentExists(db, organizationId, driver.id, false)
        )
      )
      .orderBy(desc(trips.deliveredAt), desc(trips.updatedAt))
      .limit(5),
  ])
  const currentTrip = current.at(0) ?? null
  return {
    driver: { id: driver.id, name: driver.name },
    currentTrip: currentTrip
      ? {
          ...currentTrip,
          action: await primaryDriverAction(
            organizationId,
            driver.id,
            currentTrip
          ),
        }
      : null,
    recentTrips: recent,
  }
}

export async function listDriverActiveTrips(actor: SafeAuthContext) {
  const driver = await requireLinkedDriver(actor)
  return driverTripQuery(getDatabase())
    .where(activeAssignmentWhere(actor.membership.organizationId, driver.id))
    .orderBy(desc(trips.updatedAt))
}

export async function listDriverHistory(
  actor: SafeAuthContext,
  input: DriverTripListInput
) {
  const driver = await requireLinkedDriver(actor)
  const organizationId = actor.membership.organizationId
  const db = getDatabase()
  const search = input.search.trim()
  const where = and(
    eq(trips.organizationId, organizationId),
    inArray(trips.status, HISTORY_TRIP_STATUSES),
    assignmentExists(db, organizationId, driver.id, false),
    input.status === "ALL" ? undefined : eq(trips.status, input.status),
    input.from
      ? gte(trips.deliveredAt, new Date(`${input.from}T00:00:00.000Z`))
      : undefined,
    input.to
      ? lte(trips.deliveredAt, new Date(`${input.to}T23:59:59.999Z`))
      : undefined,
    search
      ? or(
          ilike(trips.tripNumber, `%${search}%`),
          ilike(vehicles.registrationNumber, `%${search}%`)
        )
      : undefined
  )
  const [items, [total]] = await Promise.all([
    driverTripQuery(db)
      .where(where)
      .orderBy(desc(trips.deliveredAt), desc(trips.updatedAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ value: count() })
      .from(trips)
      .leftJoin(
        vehicles,
        and(
          eq(vehicles.organizationId, trips.organizationId),
          eq(vehicles.id, trips.currentVehicleId)
        )
      )
      .where(where),
  ])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

async function requireDriverTripAccess(
  actor: SafeAuthContext,
  tripId: string,
  current = false,
  transaction: DriverTransaction = getDatabase()
) {
  const driver = await requireLinkedDriver(actor)
  const organizationId = actor.membership.organizationId
  const trip = (
    await driverTripQuery(transaction)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          eq(trips.id, tripId),
          current ? eq(trips.currentDriverId, driver.id) : undefined,
          assignmentExists(transaction, organizationId, driver.id, current)
        )
      )
      .limit(1)
  ).at(0)
  if (!trip) throw new ForbiddenError()
  return { driver, trip }
}

async function primaryDriverAction(
  organizationId: string,
  driverId: string,
  trip: { id: string; status: string }
) {
  const checkIns = await getDatabase()
    .select({ type: driverCheckIns.type })
    .from(driverCheckIns)
    .where(
      and(
        eq(driverCheckIns.organizationId, organizationId),
        eq(driverCheckIns.tripId, trip.id),
        eq(driverCheckIns.driverId, driverId)
      )
    )
  const types = new Set(checkIns.map((entry) => entry.type))
  if (trip.status === "TRUCK_ASSIGNED" && !types.has("REACHED_PICKUP"))
    return "REACHED_PICKUP" as const
  if (trip.status === "LOADED") return "START_JOURNEY" as const
  if (trip.status === "IN_TRANSIT" && !types.has("REACHED_DESTINATION"))
    return "REACHED_DESTINATION" as const
  return null
}

async function driverDocuments(actor: SafeAuthContext, tripId: string) {
  return getDatabase()
    .select({
      id: documents.id,
      documentType: documents.documentType,
      title: documents.title,
      originalFilename: documentVersions.originalFilename,
      mimeType: documentVersions.mimeType,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      and(
        eq(documentVersions.organizationId, documents.organizationId),
        eq(documentVersions.documentId, documents.id),
        eq(documentVersions.versionNumber, documents.currentVersionNumber)
      )
    )
    .innerJoin(
      documentAttachments,
      and(
        eq(documentAttachments.organizationId, documents.organizationId),
        eq(documentAttachments.documentId, documents.id),
        eq(documentAttachments.tripId, tripId)
      )
    )
    .where(
      and(
        eq(documents.organizationId, actor.membership.organizationId),
        eq(documents.status, "ACTIVE"),
        inArray(documents.documentType, DRIVER_DOCUMENT_TYPES)
      )
    )
    .orderBy(desc(documentVersions.createdAt))
}

async function driverTimeline(
  actor: SafeAuthContext,
  driverId: string,
  tripId: string
) {
  const organizationId = actor.membership.organizationId
  const [statuses, checkIns] = await Promise.all([
    getDatabase()
      .select({
        id: tripStatusEvents.id,
        status: tripStatusEvents.toStatus,
        createdAt: tripStatusEvents.createdAt,
      })
      .from(tripStatusEvents)
      .where(
        and(
          eq(tripStatusEvents.organizationId, organizationId),
          eq(tripStatusEvents.tripId, tripId),
          inArray(tripStatusEvents.toStatus, [
            "TRUCK_ASSIGNED",
            "LOADED",
            "IN_TRANSIT",
            "DELIVERED",
          ])
        )
      ),
    getDatabase()
      .select({
        id: driverCheckIns.id,
        type: driverCheckIns.type,
        note: driverCheckIns.note,
        locationText: driverCheckIns.locationText,
        createdAt: driverCheckIns.createdAt,
      })
      .from(driverCheckIns)
      .where(
        and(
          eq(driverCheckIns.organizationId, organizationId),
          eq(driverCheckIns.tripId, tripId),
          eq(driverCheckIns.driverId, driverId)
        )
      ),
  ])
  return [
    ...statuses.map((event) => ({
      id: event.id,
      label:
        event.status === "TRUCK_ASSIGNED"
          ? "Assigned to trip"
          : event.status.replaceAll("_", " "),
      note: null,
      locationText: null,
      createdAt: event.createdAt,
    })),
    ...checkIns.map((event) => ({
      id: event.id,
      label: event.type.replaceAll("_", " "),
      note: event.note,
      locationText: event.locationText,
      createdAt: event.createdAt,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function getDriverTrip(actor: SafeAuthContext, tripId: string) {
  const { driver, trip } = await requireDriverTripAccess(actor, tripId)
  const [documentsList, timeline, expenses] = await Promise.all([
    driverDocuments(actor, tripId),
    driverTimeline(actor, driver.id, tripId),
    listDriverExpensesForTrip(actor, tripId),
  ])
  const isCurrentAssignment =
    trip.currentDriverId === driver.id &&
    Boolean(
      (
        await getDatabase()
          .select({ id: tripAssignments.id })
          .from(tripAssignments)
          .where(
            and(
              eq(
                tripAssignments.organizationId,
                actor.membership.organizationId
              ),
              eq(tripAssignments.tripId, tripId),
              eq(tripAssignments.driverId, driver.id),
              isNull(tripAssignments.endedAt)
            )
          )
          .limit(1)
      ).at(0)
    )
  return {
    trip,
    isCurrentAssignment,
    action: isCurrentAssignment
      ? await primaryDriverAction(
          actor.membership.organizationId,
          driver.id,
          trip
        )
      : null,
    documents: documentsList,
    timeline,
    expenses,
  }
}

export async function createDriverCheckIn(
  actor: SafeAuthContext,
  input: DriverCheckInInput
) {
  const db = getDatabase()
  return db.transaction(async (tx) => {
    const { driver, trip } = await requireDriverTripAccess(
      actor,
      input.id,
      true,
      tx
    )
    if (trip.version !== input.version)
      throw new Error("Trip changed. Refresh before trying again.")
    if (!canDriverCheckIn(trip.status, input.type))
      throw new Error(
        "This action is no longer available for the Trip's current status."
      )
    const existing = (
      await tx
        .select({ id: driverCheckIns.id })
        .from(driverCheckIns)
        .where(
          and(
            eq(driverCheckIns.organizationId, actor.membership.organizationId),
            eq(driverCheckIns.tripId, trip.id),
            eq(driverCheckIns.driverId, driver.id),
            eq(driverCheckIns.type, input.type)
          )
        )
        .limit(1)
    ).at(0)
    if (existing) throw new Error("This check-in has already been recorded.")
    const [checkIn] = await tx
      .insert(driverCheckIns)
      .values({
        organizationId: actor.membership.organizationId,
        tripId: trip.id,
        driverId: driver.id,
        type: input.type,
        note: input.note,
        locationText: input.locationText,
        actorMembershipId: actor.membership.id,
      })
      .returning()
    await recordOperationalMutation(tx, actor, {
      action: `DRIVER_${input.type}`,
      message: `${actor.user.name} recorded ${input.type.replaceAll("_", " ").toLowerCase()} for Trip ${trip.tripNumber}`,
      entityType: "TRIP",
      entityId: trip.id,
      after: {
        checkInId: checkIn.id,
        type: input.type,
        note: input.note,
        locationText: input.locationText,
      },
    })
    return checkIn
  })
}

export async function startDriverJourney(
  actor: SafeAuthContext,
  input: { id: string; version: number }
) {
  const driver = await requireLinkedDriver(actor)
  return startJourneyForDriver(actor, input, driver.id)
}

export async function listDriverExpensesForTrip(
  actor: SafeAuthContext,
  tripId: string
) {
  const { driver } = await requireDriverTripAccess(actor, tripId)
  return getDatabase()
    .select({
      id: driverExpenses.id,
      type: driverExpenses.type,
      amount: driverExpenses.amount,
      expenseDate: driverExpenses.expenseDate,
      note: driverExpenses.note,
      status: driverExpenses.status,
      receiptDocumentId: driverExpenses.receiptDocumentId,
      createdAt: driverExpenses.createdAt,
      version: driverExpenses.version,
    })
    .from(driverExpenses)
    .where(
      and(
        eq(driverExpenses.organizationId, actor.membership.organizationId),
        eq(driverExpenses.tripId, tripId),
        eq(driverExpenses.driverId, driver.id)
      )
    )
    .orderBy(desc(driverExpenses.expenseDate), desc(driverExpenses.createdAt))
}

export async function createDriverExpense(
  actor: SafeAuthContext,
  input: CreateDriverExpenseInput
) {
  return getDatabase().transaction(async (tx) => {
    const { driver, trip } = await requireDriverTripAccess(
      actor,
      input.tripId,
      true,
      tx
    )
    if (!ACTIVE_TRIP_STATUSES.some((status) => status === trip.status))
      throw new Error(
        "Expenses can only be submitted for an active assigned Trip."
      )
    const [expense] = await tx
      .insert(driverExpenses)
      .values({
        organizationId: actor.membership.organizationId,
        tripId: trip.id,
        driverId: driver.id,
        type: input.type,
        amount: input.amount,
        expenseDate: input.expenseDate,
        note: input.note,
        createdByMembershipId: actor.membership.id,
      })
      .returning()
    await recordOperationalMutation(tx, actor, {
      action: "DRIVER_EXPENSE_CREATED",
      message: `${actor.user.name} submitted a ${input.type.toLowerCase()} expense for Trip ${trip.tripNumber}`,
      entityType: "DRIVER_EXPENSE",
      entityId: expense.id,
      after: {
        tripId: trip.id,
        driverId: driver.id,
        type: input.type,
        amount: input.amount,
        expenseDate: input.expenseDate,
      },
    })
    return expense
  })
}

export async function attachDriverExpenseReceipt(
  actor: SafeAuthContext,
  input: AttachDriverExpenseReceiptInput
) {
  return getDatabase().transaction(async (tx) => {
    const driver = await requireLinkedDriver(actor)
    const expense = (
      await tx
        .select()
        .from(driverExpenses)
        .where(
          and(
            eq(driverExpenses.organizationId, actor.membership.organizationId),
            eq(driverExpenses.id, input.expenseId),
            eq(driverExpenses.driverId, driver.id)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!expense) throw new ForbiddenError()
    await requireDriverTripAccess(actor, expense.tripId, true, tx)
    if (expense.status !== "PENDING" || expense.version !== input.version)
      throw new Error("Only the current pending expense can receive a receipt.")
    const document = (
      await tx
        .select({ id: documents.id })
        .from(documents)
        .innerJoin(
          documentAttachments,
          and(
            eq(documentAttachments.organizationId, documents.organizationId),
            eq(documentAttachments.documentId, documents.id),
            eq(documentAttachments.tripId, expense.tripId)
          )
        )
        .where(
          and(
            eq(documents.organizationId, actor.membership.organizationId),
            eq(documents.id, input.documentId),
            eq(documents.documentType, "OTHER"),
            eq(documents.status, "ACTIVE"),
            eq(documents.createdByMembershipId, actor.membership.id)
          )
        )
        .limit(1)
    ).at(0)
    if (!document) throw new ForbiddenError()
    const updated = (
      await tx
        .update(driverExpenses)
        .set({
          receiptDocumentId: document.id,
          version: expense.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(driverExpenses.organizationId, actor.membership.organizationId),
            eq(driverExpenses.id, expense.id),
            eq(driverExpenses.version, expense.version),
            eq(driverExpenses.status, "PENDING")
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new Error("Expense changed. Refresh and try again.")
    await recordOperationalMutation(tx, actor, {
      action: "DRIVER_EXPENSE_RECEIPT_ATTACHED",
      message: `${actor.user.name} attached a receipt to a Driver expense`,
      entityType: "DRIVER_EXPENSE",
      entityId: expense.id,
      before: {
        receiptDocumentId: expense.receiptDocumentId,
        version: expense.version,
      },
      after: { receiptDocumentId: document.id, version: updated.version },
    })
    return updated
  })
}

export async function listOperationalDriverExpenses(
  actor: SafeAuthContext,
  tripId: string
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase()
    .select({
      id: driverExpenses.id,
      driver: drivers.name,
      type: driverExpenses.type,
      amount: driverExpenses.amount,
      expenseDate: driverExpenses.expenseDate,
      note: driverExpenses.note,
      status: driverExpenses.status,
      receiptDocumentId: driverExpenses.receiptDocumentId,
      reviewNote: driverExpenses.reviewNote,
      reviewedBy: reviewerUsers.name,
      reviewedAt: driverExpenses.reviewedAt,
      version: driverExpenses.version,
    })
    .from(driverExpenses)
    .innerJoin(
      drivers,
      and(
        eq(drivers.organizationId, driverExpenses.organizationId),
        eq(drivers.id, driverExpenses.driverId)
      )
    )
    .leftJoin(
      reviewerMemberships,
      and(
        eq(reviewerMemberships.organizationId, driverExpenses.organizationId),
        eq(reviewerMemberships.id, driverExpenses.reviewedByMembershipId)
      )
    )
    .leftJoin(reviewerUsers, eq(reviewerUsers.id, reviewerMemberships.userId))
    .where(
      and(
        eq(driverExpenses.organizationId, organizationId),
        eq(driverExpenses.tripId, tripId)
      )
    )
    .orderBy(desc(driverExpenses.expenseDate), desc(driverExpenses.createdAt))
}

export async function reviewDriverExpense(
  actor: SafeAuthContext,
  input: ReviewDriverExpenseInput
) {
  if (!canReviewDriverExpense(actor.membership.role)) throw new ForbiddenError()
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const expense = (
      await tx
        .select()
        .from(driverExpenses)
        .where(
          and(
            eq(driverExpenses.organizationId, organizationId),
            eq(driverExpenses.id, input.expenseId)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!expense) throw new ForbiddenError()
    if (expense.status !== "PENDING" || expense.version !== input.version)
      throw new Error("Only the current pending expense can be reviewed.")
    const updated = (
      await tx
        .update(driverExpenses)
        .set({
          status: input.status,
          reviewedByMembershipId: actor.membership.id,
          reviewedAt: new Date(),
          reviewNote: input.note,
          version: expense.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(driverExpenses.organizationId, organizationId),
            eq(driverExpenses.id, expense.id),
            eq(driverExpenses.status, "PENDING"),
            eq(driverExpenses.version, expense.version)
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new Error("Expense changed. Refresh and try again.")
    await recordOperationalMutation(tx, actor, {
      action: `DRIVER_EXPENSE_${input.status}`,
      message: `${actor.user.name} ${input.status.toLowerCase()} a Driver expense`,
      entityType: "DRIVER_EXPENSE",
      entityId: expense.id,
      before: { status: expense.status, version: expense.version },
      after: { status: updated.status, version: updated.version },
      reason: input.note,
    })
    return updated
  })
}

export async function getDriverProfile(actor: SafeAuthContext) {
  return requireLinkedDriver(actor)
}
