import "@tanstack/react-start/server-only"

import { and, eq } from "drizzle-orm"
import type { z } from "zod"

import { requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  dealStatusEvents,
  deals,
  organizations,
  trips,
  tripSettlements,
} from "@/server/db/schema"
import { calculateWeightReconciliation } from "@/server/operations/decimal"
import {
  recordOperationalMutation,
  recordTripStatus,
  requireOperationsActor,
} from "@/server/operations/shared.server"
import {
  assertTripTransition,
  TripConcurrencyError,
} from "@/server/operations/trip-state"
import { calculateMaterialValue } from "./money"
import type {
  closeDealSchema,
  setFreightSchema,
  tripFinanceMutationSchema,
} from "./schemas"
import { computeTripFinance } from "./summary.server"

type SetFreightInput = z.infer<typeof setFreightSchema>
type TripFinanceMutationInput = z.infer<typeof tripFinanceMutationSchema>
type CloseDealInput = z.infer<typeof closeDealSchema>

export async function setTripFreight(
  actor: SafeAuthContext,
  input: SetFreightInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const trip = (
      await tx
        .select()
        .from(trips)
        .where(
          and(eq(trips.organizationId, organizationId), eq(trips.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!trip) throw new Error("Trip not found.")
    if (trip.version !== input.version) throw new TripConcurrencyError()
    if (inArrayValue(trip.status, ["SETTLED", "ARCHIVED", "CANCELLED"]))
      throw new Error("Freight cannot be changed after financial completion.")
    const updated = (
      await tx
        .update(trips)
        .set({
          agreedFreightAmount: input.amount,
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: trip.version + 1,
        })
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, trip.id),
            eq(trips.version, trip.version)
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new TripConcurrencyError()
    await recordOperationalMutation(tx, actor, {
      action: "TRIP_FREIGHT_SET",
      message: `${actor.user.name} set freight for Trip ${trip.tripNumber}`,
      entityType: "TRIP",
      entityId: trip.id,
      before: { agreedFreightAmount: trip.agreedFreightAmount },
      after: { agreedFreightAmount: input.amount },
    })
    return updated
  })
}

function inArrayValue<T>(value: T, values: readonly T[]): boolean {
  return values.includes(value)
}

export async function beginSettlement(
  actor: SafeAuthContext,
  input: TripFinanceMutationInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const trip = (
      await tx
        .select()
        .from(trips)
        .where(
          and(eq(trips.organizationId, organizationId), eq(trips.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!trip) throw new Error("Trip not found.")
    if (trip.version !== input.version) throw new TripConcurrencyError()
    assertTripTransition(trip.status, "SETTLEMENT_PENDING")
    if (!trip.finalWeightMt)
      throw new Error("Trip final weight is required before settlement.")
    const updated = (
      await tx
        .update(trips)
        .set({
          status: "SETTLEMENT_PENDING",
          acceptedFinalWeightMt: trip.finalWeightMt,
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: trip.version + 1,
        })
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, trip.id),
            eq(trips.version, trip.version),
            eq(trips.status, "DELIVERED")
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new TripConcurrencyError()
    await recordTripStatus(tx, actor, {
      tripId: trip.id,
      fromStatus: "DELIVERED",
      toStatus: "SETTLEMENT_PENDING",
    })
    await recordOperationalMutation(tx, actor, {
      action: "TRIP_SETTLEMENT_STARTED",
      message: `${actor.user.name} started settlement for Trip ${trip.tripNumber}`,
      entityType: "TRIP",
      entityId: trip.id,
      before: { status: trip.status },
      after: {
        status: "SETTLEMENT_PENDING",
        acceptedFinalWeightMt: trip.finalWeightMt,
      },
    })
    return updated
  })
}

export async function completeSettlement(
  actor: SafeAuthContext,
  input: TripFinanceMutationInput
) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (tx) => {
    const trip = (
      await tx
        .select()
        .from(trips)
        .where(
          and(eq(trips.organizationId, organizationId), eq(trips.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!trip) throw new Error("Trip not found.")
    if (trip.version !== input.version) throw new TripConcurrencyError()
    assertTripTransition(trip.status, "SETTLED")
    const existing = (
      await tx
        .select({ id: tripSettlements.id })
        .from(tripSettlements)
        .where(
          and(
            eq(tripSettlements.organizationId, organizationId),
            eq(tripSettlements.tripId, trip.id)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (existing) throw new Error("Trip already has an active settlement.")
    const finance = await computeTripFinance(tx, organizationId, trip.id)
    if (!finance.readiness.ready)
      throw new Error(
        `Settlement incomplete: ${finance.readiness.blockers.join("; ")}`
      )
    if (!trip.loadedWeightMt || !trip.finalWeightMt)
      throw new Error("Trip weights are incomplete.")
    const settings = (
      await tx
        .select({ threshold: organizations.weightWarningThresholdPct })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
    ).at(0)
    const weight = calculateWeightReconciliation(
      trip.loadedWeightMt,
      trip.finalWeightMt,
      settings?.threshold
    )
    const purchaseAmount = calculateMaterialValue(
      trip.finalWeightMt,
      finance.trip.purchaseRate
    )
    const [snapshot] = await tx
      .insert(tripSettlements)
      .values({
        organizationId,
        tripId: trip.id,
        loadedWeightMt: trip.loadedWeightMt,
        finalWeightMt: trip.finalWeightMt,
        acceptedFinalWeightMt: trip.finalWeightMt,
        purchaseRate: finance.trip.purchaseRate,
        weightDifferenceMt: weight.differenceMt,
        weightDifferencePercent: weight.differencePercent,
        purchaseAmount,
        vendorPaidAmount: finance.purchase.paid,
        agreedFreightAmount: finance.transport.freight ?? "0.00",
        transporterPaidAmount: finance.transport.paid,
        billedAmount: finance.sale.billed,
        companyReceivedAmount: finance.sale.received,
        sourceTripVersion: trip.version,
        postedByMembershipId: actor.membership.id,
      })
      .returning()
    const updated = (
      await tx
        .update(trips)
        .set({
          acceptedFinalWeightMt: trip.finalWeightMt,
          status: "SETTLED",
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: trip.version + 1,
        })
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, trip.id),
            eq(trips.version, trip.version),
            eq(trips.status, "SETTLEMENT_PENDING")
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new TripConcurrencyError()
    await recordTripStatus(tx, actor, {
      tripId: trip.id,
      fromStatus: "SETTLEMENT_PENDING",
      toStatus: "SETTLED",
    })
    await recordOperationalMutation(tx, actor, {
      action: "TRIP_SETTLED",
      message: `${actor.user.name} completed settlement for Trip ${trip.tripNumber}`,
      entityType: "TRIP",
      entityId: trip.id,
      before: { status: trip.status, version: trip.version },
      after: {
        status: "SETTLED",
        version: trip.version + 1,
        settlementId: snapshot.id,
      },
    })
    return updated
  })
}

export async function archiveTrip(
  actor: SafeAuthContext,
  input: TripFinanceMutationInput
) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (tx) => {
    const trip = (
      await tx
        .select()
        .from(trips)
        .where(
          and(eq(trips.organizationId, organizationId), eq(trips.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!trip) throw new Error("Trip not found.")
    if (trip.version !== input.version) throw new TripConcurrencyError()
    assertTripTransition(trip.status, "ARCHIVED")
    const updated = (
      await tx
        .update(trips)
        .set({
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: trip.version + 1,
        })
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, trip.id),
            eq(trips.version, trip.version),
            eq(trips.status, "SETTLED")
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new TripConcurrencyError()
    await recordTripStatus(tx, actor, {
      tripId: trip.id,
      fromStatus: "SETTLED",
      toStatus: "ARCHIVED",
    })
    await recordOperationalMutation(tx, actor, {
      action: "TRIP_ARCHIVED",
      message: `${actor.user.name} archived Trip ${trip.tripNumber}`,
      entityType: "TRIP",
      entityId: trip.id,
      before: { status: trip.status },
      after: { status: "ARCHIVED" },
    })
    return updated
  })
}

export async function closeDeal(actor: SafeAuthContext, input: CloseDealInput) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const deal = (
      await tx
        .select()
        .from(deals)
        .where(
          and(eq(deals.organizationId, organizationId), eq(deals.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!deal) throw new Error("Deal not found.")
    if (deal.version !== input.version)
      throw new Error("This Deal was updated. Refresh and try again.")
    if (deal.status !== "ACTIVE")
      throw new Error("Only an active Deal can close.")
    const dealTrips = await tx
      .select({ id: trips.id, status: trips.status })
      .from(trips)
      .where(
        and(eq(trips.organizationId, organizationId), eq(trips.dealId, deal.id))
      )
      .for("update")
    if (!dealTrips.length) throw new Error("Deal has no Trips to complete.")
    const incomplete = dealTrips.filter(
      (trip) => !["CANCELLED", "SETTLED", "ARCHIVED"].includes(trip.status)
    )
    if (incomplete.length)
      throw new Error(
        "All non-cancelled Trips must be settled before closing the Deal."
      )
    const updated = (
      await tx
        .update(deals)
        .set({
          status: "FULFILLED",
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: deal.version + 1,
        })
        .where(
          and(
            eq(deals.organizationId, organizationId),
            eq(deals.id, deal.id),
            eq(deals.version, deal.version),
            eq(deals.status, "ACTIVE")
          )
        )
        .returning()
    ).at(0)
    if (!updated)
      throw new Error("This Deal was updated. Refresh and try again.")
    await tx.insert(dealStatusEvents).values({
      organizationId,
      dealId: deal.id,
      fromStatus: "ACTIVE",
      toStatus: "FULFILLED",
      changedByMembershipId: actor.membership.id,
      reason: input.reason,
    })
    await recordOperationalMutation(tx, actor, {
      action: "DEAL_CLOSED",
      message: `${actor.user.name} closed Deal ${deal.dealNumber}`,
      entityType: "DEAL",
      entityId: deal.id,
      before: { status: deal.status },
      after: { status: "FULFILLED" },
      reason: input.reason,
    })
    return updated
  })
}
