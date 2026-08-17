import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull, ne } from "drizzle-orm"
import type { z } from "zod"

import { requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  billLines,
  bills,
  companies,
  paymentAllocations,
  payments,
  trips,
  vehicles,
} from "@/server/db/schema"
import {
  recordOperationalMutation,
  requireOperationsActor,
} from "@/server/operations/shared.server"
import { calculateRateFromAmount } from "./money"
import type {
  billCreateSchema,
  billMutationSchema,
  voidBillSchema,
} from "./schemas"

type CreateBillInput = z.infer<typeof billCreateSchema>
type BillMutationInput = z.infer<typeof billMutationSchema>
type VoidBillInput = z.infer<typeof voidBillSchema>

export async function createBill(
  actor: SafeAuthContext,
  input: CreateBillInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const existing = (
      await tx
        .select({ id: bills.id })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            eq(bills.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1)
    ).at(0)
    if (existing) return existing
    const trip = (
      await tx
        .select({
          id: trips.id,
          tripNumber: trips.tripNumber,
          companyId: trips.destinationCompanyId,
          status: trips.status,
          finalWeightMt: trips.finalWeightMt,
        })
        .from(trips)
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, input.tripId)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!trip || !trip.finalWeightMt)
      throw new Error("Only a delivered Trip with final weight can be billed.")
    if (!["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"].includes(trip.status))
      throw new Error("Trip is not eligible for billing.")
    if (trip.companyId !== input.companyId)
      throw new Error("Bill Company must match the Trip destination Company.")
    const company = (
      await tx
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.organizationId, organizationId),
            eq(companies.id, input.companyId),
            eq(companies.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)
    if (!company) throw new Error("Company is not active.")
    const activeLine = (
      await tx
        .select({ id: billLines.id })
        .from(billLines)
        .where(
          and(
            eq(billLines.organizationId, organizationId),
            eq(billLines.tripId, input.tripId),
            isNull(billLines.voidedAt)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (activeLine) throw new Error("Trip already belongs to an active Bill.")
    const id = randomUUID()
    const [record] = await tx
      .insert(bills)
      .values({
        id,
        organizationId,
        companyId: input.companyId,
        billNumber: input.billNumber,
        idempotencyKey: input.idempotencyKey,
        billDate: input.billDate,
        status: "DRAFT",
        totalAmount: input.billedAmount,
        notes: input.notes,
        createdByMembershipId: actor.membership.id,
        updatedByMembershipId: actor.membership.id,
      })
      .returning()
    await tx.insert(billLines).values({
      organizationId,
      billId: id,
      tripId: input.tripId,
      description: `Transport of material - ${trip.tripNumber}`,
      quantityMt: trip.finalWeightMt,
      rate: calculateRateFromAmount(input.billedAmount, trip.finalWeightMt),
      lineAmount: input.billedAmount,
      createdByMembershipId: actor.membership.id,
    })
    await recordOperationalMutation(tx, actor, {
      action: "BILL_CREATED",
      message: `${actor.user.name} prepared Bill ${input.billNumber}`,
      entityType: "BILL",
      entityId: id,
      after: {
        billNumber: input.billNumber,
        tripId: input.tripId,
        amount: input.billedAmount,
        status: "DRAFT",
      },
    })
    return record
  })
}

export async function issueBill(
  actor: SafeAuthContext,
  input: BillMutationInput
) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (tx) => {
    const bill = (
      await tx
        .select()
        .from(bills)
        .where(
          and(eq(bills.organizationId, organizationId), eq(bills.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!bill) throw new Error("Bill not found.")
    if (bill.version !== input.version)
      throw new Error("This Bill was updated. Refresh and try again.")
    if (bill.status !== "DRAFT")
      throw new Error("Only a draft Bill can be issued.")
    const updated = (
      await tx
        .update(bills)
        .set({
          status: "ISSUED",
          issuedAt: new Date(),
          issuedByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
          updatedAt: new Date(),
          version: bill.version + 1,
        })
        .where(
          and(
            eq(bills.organizationId, organizationId),
            eq(bills.id, bill.id),
            eq(bills.version, bill.version),
            eq(bills.status, "DRAFT")
          )
        )
        .returning()
    ).at(0)
    if (!updated)
      throw new Error("This Bill was updated. Refresh and try again.")
    await recordOperationalMutation(tx, actor, {
      action: "BILL_ISSUED",
      message: `${actor.user.name} issued Bill ${bill.billNumber}`,
      entityType: "BILL",
      entityId: bill.id,
      before: { status: bill.status, version: bill.version },
      after: { status: "ISSUED", version: bill.version + 1 },
    })
    return updated
  })
}

export async function voidBill(actor: SafeAuthContext, input: VoidBillInput) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (tx) => {
    const bill = (
      await tx
        .select()
        .from(bills)
        .where(
          and(eq(bills.organizationId, organizationId), eq(bills.id, input.id))
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!bill) throw new Error("Bill not found.")
    if (bill.version !== input.version)
      throw new Error("This Bill was updated. Refresh and try again.")
    if (bill.status === "VOID") throw new Error("Bill is already void.")
    const receipt = (
      await tx
        .select({ id: paymentAllocations.id })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(paymentAllocations.organizationId, organizationId),
            eq(paymentAllocations.billId, bill.id),
            ne(payments.status, "DRAFT")
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (receipt)
      throw new Error(
        "Reverse allocated Company receipts before voiding this Bill."
      )
    const now = new Date()
    const updated = (
      await tx
        .update(bills)
        .set({
          status: "VOID",
          voidedAt: now,
          voidedByMembershipId: actor.membership.id,
          voidReason: input.reason,
          updatedByMembershipId: actor.membership.id,
          updatedAt: now,
          version: bill.version + 1,
        })
        .where(
          and(
            eq(bills.organizationId, organizationId),
            eq(bills.id, bill.id),
            eq(bills.version, bill.version)
          )
        )
        .returning()
    ).at(0)
    if (!updated)
      throw new Error("This Bill was updated. Refresh and try again.")
    await tx
      .update(billLines)
      .set({ voidedAt: now })
      .where(
        and(
          eq(billLines.organizationId, organizationId),
          eq(billLines.billId, bill.id),
          isNull(billLines.voidedAt)
        )
      )
    await recordOperationalMutation(tx, actor, {
      action: "BILL_VOIDED",
      message: `${actor.user.name} voided Bill ${bill.billNumber}`,
      entityType: "BILL",
      entityId: bill.id,
      before: { status: bill.status },
      after: { status: "VOID" },
      reason: input.reason,
    })
    return updated
  })
}

export async function getBill(actor: SafeAuthContext, id: string) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const bill = (
    await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        billDate: bills.billDate,
        status: bills.status,
        totalAmount: bills.totalAmount,
        notes: bills.notes,
        company: companies.name,
        companyId: bills.companyId,
        issuedAt: bills.issuedAt,
        voidedAt: bills.voidedAt,
        voidReason: bills.voidReason,
        createdAt: bills.createdAt,
        version: bills.version,
      })
      .from(bills)
      .innerJoin(companies, eq(companies.id, bills.companyId))
      .where(and(eq(bills.organizationId, organizationId), eq(bills.id, id)))
      .limit(1)
  ).at(0)
  if (!bill) throw new Error("Bill not found.")
  const lines = await db
    .select({
      id: billLines.id,
      tripId: billLines.tripId,
      tripNumber: trips.tripNumber,
      vehicle: vehicles.registrationNumber,
      quantityMt: billLines.quantityMt,
      rate: billLines.rate,
      lineAmount: billLines.lineAmount,
      voidedAt: billLines.voidedAt,
    })
    .from(billLines)
    .innerJoin(trips, eq(trips.id, billLines.tripId))
    .leftJoin(vehicles, eq(vehicles.id, trips.currentVehicleId))
    .where(
      and(
        eq(billLines.organizationId, organizationId),
        eq(billLines.billId, id)
      )
    )
    .orderBy(desc(billLines.createdAt))
  return { ...bill, lines }
}
