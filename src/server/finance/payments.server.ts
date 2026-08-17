import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { z } from "zod"

import { requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  companies,
  deals,
  memberships,
  paymentAllocations,
  payments,
  transporters,
  trips,
  users,
  vendors,
} from "@/server/db/schema"
import {
  normalizeReference,
  recordOperationalMutation,
  requireOperationsActor,
} from "@/server/operations/shared.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import type {
  createPaymentSchema,
  paymentListSchema,
  reversePaymentSchema,
} from "./schemas"

type PaymentListInput = z.infer<typeof paymentListSchema>
type CreatePaymentInput = z.infer<typeof createPaymentSchema>
type ReversePaymentInput = z.infer<typeof reversePaymentSchema>

const recordedMemberships = alias(memberships, "payment_recorded_memberships")
const recordedUsers = alias(users, "payment_recorded_users")
const paidMemberships = alias(memberships, "payment_paid_memberships")
const paidUsers = alias(users, "payment_paid_users")

function paymentNumber(id: string): string {
  return `PY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`
}

function listWhere(organizationId: string, input: PaymentListInput) {
  const search = input.search.trim()
  return and(
    eq(payments.organizationId, organizationId),
    input.direction === "ALL"
      ? undefined
      : eq(payments.direction, input.direction),
    input.type === "ALL" ? undefined : eq(payments.type, input.type),
    input.partyType === "VENDOR"
      ? isNotNull(payments.vendorId)
      : input.partyType === "TRANSPORTER"
        ? isNotNull(payments.transporterId)
        : input.partyType === "COMPANY"
          ? isNotNull(payments.companyId)
          : undefined,
    input.recordedByMembershipId
      ? eq(payments.recordedByMembershipId, input.recordedByMembershipId)
      : undefined,
    input.from ? gte(payments.paymentDate, input.from) : undefined,
    input.to ? lte(payments.paymentDate, input.to) : undefined,
    search
      ? or(
          ilike(payments.paymentNumber, `%${search}%`),
          ilike(payments.receiptNumber, `%${search}%`),
          ilike(vendors.name, `%${search}%`),
          ilike(transporters.name, `%${search}%`),
          ilike(companies.name, `%${search}%`),
          ilike(deals.dealNumber, `%${search}%`),
          ilike(trips.tripNumber, `%${search}%`),
          ilike(bills.billNumber, `%${search}%`)
        )
      : undefined
  )
}

function paymentListQuery(
  db: ReturnType<typeof getDatabase>,
  organizationId: string,
  input: PaymentListInput
) {
  return db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      direction: payments.direction,
      type: payments.type,
      status: payments.status,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMode: payments.paymentMode,
      receiptNumber: payments.receiptNumber,
      vendor: vendors.name,
      transporter: transporters.name,
      company: companies.name,
      dealNumber: deals.dealNumber,
      tripNumber: trips.tripNumber,
      billNumber: bills.billNumber,
      recordedBy: recordedUsers.name,
      createdAt: payments.createdAt,
      version: payments.version,
    })
    .from(payments)
    .leftJoin(vendors, eq(vendors.id, payments.vendorId))
    .leftJoin(transporters, eq(transporters.id, payments.transporterId))
    .leftJoin(companies, eq(companies.id, payments.companyId))
    .leftJoin(paymentAllocations, eq(paymentAllocations.paymentId, payments.id))
    .leftJoin(deals, eq(deals.id, paymentAllocations.dealId))
    .leftJoin(trips, eq(trips.id, paymentAllocations.tripId))
    .leftJoin(bills, eq(bills.id, paymentAllocations.billId))
    .innerJoin(
      recordedMemberships,
      eq(recordedMemberships.id, payments.recordedByMembershipId)
    )
    .innerJoin(recordedUsers, eq(recordedUsers.id, recordedMemberships.userId))
    .where(listWhere(organizationId, input))
}

export async function listPayments(
  actor: SafeAuthContext,
  input: PaymentListInput
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [items, [total]] = await Promise.all([
    paymentListQuery(db, organizationId, input)
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ value: count() })
      .from(payments)
      .leftJoin(vendors, eq(vendors.id, payments.vendorId))
      .leftJoin(transporters, eq(transporters.id, payments.transporterId))
      .leftJoin(companies, eq(companies.id, payments.companyId))
      .leftJoin(
        paymentAllocations,
        eq(paymentAllocations.paymentId, payments.id)
      )
      .leftJoin(deals, eq(deals.id, paymentAllocations.dealId))
      .leftJoin(trips, eq(trips.id, paymentAllocations.tripId))
      .leftJoin(bills, eq(bills.id, paymentAllocations.billId))
      .innerJoin(
        recordedMemberships,
        eq(recordedMemberships.id, payments.recordedByMembershipId)
      )
      .innerJoin(
        recordedUsers,
        eq(recordedUsers.id, recordedMemberships.userId)
      )
      .where(listWhere(organizationId, input)),
  ])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

async function validateCounterpartyAndTarget(
  tx: OperationsTransaction,
  organizationId: string,
  input: CreatePaymentInput
) {
  if (input.partyType === "VENDOR") {
    const party = (
      await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(
          and(
            eq(vendors.organizationId, organizationId),
            eq(vendors.id, input.partyId),
            eq(vendors.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)
    if (!party) throw new Error("Vendor is not active in this organization.")
    if (input.dealId) {
      const deal = (
        await tx
          .select({ id: deals.id })
          .from(deals)
          .where(
            and(
              eq(deals.organizationId, organizationId),
              eq(deals.id, input.dealId),
              eq(deals.vendorId, input.partyId)
            )
          )
          .limit(1)
      ).at(0)
      if (!deal) throw new Error("Deal does not belong to this Vendor.")
    }
    if (input.tripId) {
      const trip = (
        await tx
          .select({ id: trips.id })
          .from(trips)
          .innerJoin(deals, eq(deals.id, trips.dealId))
          .where(
            and(
              eq(trips.organizationId, organizationId),
              eq(trips.id, input.tripId),
              eq(deals.vendorId, input.partyId)
            )
          )
          .limit(1)
      ).at(0)
      if (!trip) throw new Error("Trip does not belong to this Vendor.")
    }
  } else if (input.partyType === "TRANSPORTER") {
    const party = (
      await tx
        .select({ id: transporters.id })
        .from(transporters)
        .where(
          and(
            eq(transporters.organizationId, organizationId),
            eq(transporters.id, input.partyId),
            eq(transporters.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)
    if (!party)
      throw new Error("Transporter is not active in this organization.")
    if (!input.tripId) throw new Error("Transporter payment requires a Trip.")
    const trip = (
      await tx
        .select({ id: trips.id })
        .from(trips)
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, input.tripId),
            eq(trips.currentTransporterId, input.partyId)
          )
        )
        .limit(1)
    ).at(0)
    if (!trip) throw new Error("Trip is not assigned to this Transporter.")
  } else {
    const party = (
      await tx
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.organizationId, organizationId),
            eq(companies.id, input.partyId),
            eq(companies.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)
    if (!party) throw new Error("Company is not active in this organization.")
    if (!input.billId)
      throw new Error("Company receipt requires an issued Bill.")
    const bill = (
      await tx
        .select({ id: bills.id })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            eq(bills.id, input.billId),
            eq(bills.companyId, input.partyId),
            eq(bills.status, "ISSUED")
          )
        )
        .limit(1)
    ).at(0)
    if (!bill) throw new Error("Bill is not issued to this Company.")
  }
}

export async function createPayment(
  actor: SafeAuthContext,
  input: CreatePaymentInput
) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase().transaction(async (tx) => {
    const existing = (
      await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1)
    ).at(0)
    if (existing) return existing
    await validateCounterpartyAndTarget(tx, organizationId, input)
    const paidByMembershipId = input.paidByMembershipId ?? actor.membership.id
    const payer = (
      await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.id, paidByMembershipId),
            eq(memberships.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)
    if (!payer) throw new Error("Paid By Member is not active.")
    const id = randomUUID()
    const number = paymentNumber(id)
    const counterparty = {
      vendorId: input.partyType === "VENDOR" ? input.partyId : null,
      transporterId: input.partyType === "TRANSPORTER" ? input.partyId : null,
      companyId: input.partyType === "COMPANY" ? input.partyId : null,
    }
    const [record] = await tx
      .insert(payments)
      .values({
        id,
        organizationId,
        paymentNumber: number,
        idempotencyKey: input.idempotencyKey,
        direction: input.direction,
        type: input.type,
        status: "POSTED",
        ...counterparty,
        amount: input.amount,
        paymentDate: input.paymentDate,
        paymentMode: input.paymentMode,
        receiptNumber: input.receiptNumber,
        normalizedReceiptNumber: input.receiptNumber
          ? normalizeReference(input.receiptNumber)
          : null,
        notes: input.notes,
        recordedByMembershipId: actor.membership.id,
        paidByMembershipId,
        postedAt: new Date(),
      })
      .returning()
    const target = input.dealId
      ? { dealId: input.dealId }
      : input.tripId
        ? { tripId: input.tripId }
        : input.billId
          ? { billId: input.billId }
          : null
    if (target)
      await tx.insert(paymentAllocations).values({
        organizationId,
        paymentId: id,
        ...target,
        amount: input.amount,
        allocatedByMembershipId: actor.membership.id,
      })
    await recordOperationalMutation(tx, actor, {
      action: "PAYMENT_POSTED",
      message: `${actor.user.name} recorded Payment ${number}`,
      entityType: "PAYMENT",
      entityId: id,
      after: {
        paymentNumber: number,
        direction: input.direction,
        type: input.type,
        amount: input.amount,
        partyType: input.partyType,
        target,
      },
    })
    return record
  })
}

export async function reversePayment(
  actor: SafeAuthContext,
  input: ReversePaymentInput
) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (tx) => {
    const existing = (
      await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1)
    ).at(0)
    if (existing) return existing
    const original = (
      await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.id, input.id)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!original) throw new Error("Payment not found.")
    if (original.version !== input.version)
      throw new Error("This Payment was updated. Refresh and try again.")
    if (original.status !== "POSTED")
      throw new Error("Only a posted Payment can be reversed.")
    const allocations = await tx
      .select()
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.organizationId, organizationId),
          eq(paymentAllocations.paymentId, original.id)
        )
      )
    const reversalId = randomUUID()
    const number = paymentNumber(reversalId)
    const [reversal] = await tx
      .insert(payments)
      .values({
        id: reversalId,
        organizationId,
        paymentNumber: number,
        idempotencyKey: input.idempotencyKey,
        direction: original.direction === "OUTGOING" ? "INCOMING" : "OUTGOING",
        type: "ADJUSTMENT",
        status: "POSTED",
        vendorId: original.vendorId,
        transporterId: original.transporterId,
        companyId: original.companyId,
        amount: original.amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: original.paymentMode,
        notes: `Reversal of ${original.paymentNumber}`,
        recordedByMembershipId: actor.membership.id,
        paidByMembershipId: actor.membership.id,
        reversalOfPaymentId: original.id,
        reversalReason: input.reason,
        postedAt: new Date(),
      })
      .returning()
    if (allocations.length)
      await tx.insert(paymentAllocations).values(
        allocations.map((allocation) => ({
          organizationId,
          paymentId: reversalId,
          dealId: allocation.dealId,
          tripId: allocation.tripId,
          billId: allocation.billId,
          amount: allocation.amount,
          allocatedByMembershipId: actor.membership.id,
        }))
      )
    const updated = await tx
      .update(payments)
      .set({
        status: "REVERSED",
        reversedAt: new Date(),
        version: original.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.id, original.id),
          eq(payments.version, original.version),
          eq(payments.status, "POSTED")
        )
      )
      .returning({ id: payments.id })
    if (!updated.length)
      throw new Error("This Payment was updated. Refresh and try again.")
    await recordOperationalMutation(tx, actor, {
      action: "PAYMENT_REVERSED",
      message: `${actor.user.name} reversed Payment ${original.paymentNumber}`,
      entityType: "PAYMENT",
      entityId: original.id,
      before: { status: original.status, amount: original.amount },
      after: { status: "REVERSED", reversalPaymentId: reversalId },
      reason: input.reason,
    })
    return reversal
  })
}

export async function getPayment(actor: SafeAuthContext, id: string) {
  const organizationId = requireOperationsActor(actor)
  const record = (
    await getDatabase()
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        direction: payments.direction,
        type: payments.type,
        status: payments.status,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMode: payments.paymentMode,
        receiptNumber: payments.receiptNumber,
        notes: payments.notes,
        version: payments.version,
        vendor: vendors.name,
        transporter: transporters.name,
        company: companies.name,
        paidBy: paidUsers.name,
        recordedBy: recordedUsers.name,
        postedAt: payments.postedAt,
        reversedAt: payments.reversedAt,
        reversalReason: payments.reversalReason,
        reversalOfPaymentId: payments.reversalOfPaymentId,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(vendors, eq(vendors.id, payments.vendorId))
      .leftJoin(transporters, eq(transporters.id, payments.transporterId))
      .leftJoin(companies, eq(companies.id, payments.companyId))
      .innerJoin(
        recordedMemberships,
        eq(recordedMemberships.id, payments.recordedByMembershipId)
      )
      .innerJoin(
        recordedUsers,
        eq(recordedUsers.id, recordedMemberships.userId)
      )
      .leftJoin(
        paidMemberships,
        eq(paidMemberships.id, payments.paidByMembershipId)
      )
      .leftJoin(paidUsers, eq(paidUsers.id, paidMemberships.userId))
      .where(
        and(eq(payments.organizationId, organizationId), eq(payments.id, id))
      )
      .limit(1)
  ).at(0)
  if (!record) throw new Error("Payment not found.")
  const allocations = await getDatabase()
    .select({
      id: paymentAllocations.id,
      amount: paymentAllocations.amount,
      dealId: paymentAllocations.dealId,
      dealNumber: deals.dealNumber,
      tripId: paymentAllocations.tripId,
      tripNumber: trips.tripNumber,
      billId: paymentAllocations.billId,
      billNumber: bills.billNumber,
    })
    .from(paymentAllocations)
    .leftJoin(deals, eq(deals.id, paymentAllocations.dealId))
    .leftJoin(trips, eq(trips.id, paymentAllocations.tripId))
    .leftJoin(bills, eq(bills.id, paymentAllocations.billId))
    .where(
      and(
        eq(paymentAllocations.organizationId, organizationId),
        eq(paymentAllocations.paymentId, id)
      )
    )
  return { ...record, allocations }
}
