import "@tanstack/react-start/server-only"

import { and, count, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { ForbiddenError, requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  deals,
  documentAttachments,
  documents,
  documentVersions,
  drivers,
  locations,
  materials,
  paymentAllocations,
  payments,
  trips,
  vehicles,
  vendors,
} from "@/server/db/schema"
import {
  calculateMaterialValue,
  formatMoney,
  parseMoney,
  signedPaymentAmount,
} from "@/server/finance/money"
import type { VendorDocumentListInput, VendorLoadListInput } from "./schemas"

const pickupLocations = alias(locations, "vendor_pickup_locations")
const destinationLocations = alias(locations, "vendor_destination_locations")
const allocationDeals = alias(deals, "vendor_allocation_deals")
const allocationTrips = alias(trips, "vendor_allocation_trips")
const allocationTripDeals = alias(deals, "vendor_allocation_trip_deals")
const documentDeals = alias(deals, "vendor_document_deals")
const documentTrips = alias(trips, "vendor_document_trips")
const documentTripDeals = alias(deals, "vendor_document_trip_deals")
const documentPayments = alias(payments, "vendor_document_payments")

export async function requireLinkedVendor(actor: SafeAuthContext) {
  requireRole(actor, ["VENDOR"])
  const vendor = (
    await getDatabase()
      .select({
        id: vendors.id,
        name: vendors.name,
        contactPerson: vendors.contactPerson,
        phone: vendors.phoneE164,
        location: vendors.location,
        status: vendors.status,
        createdAt: vendors.createdAt,
      })
      .from(vendors)
      .where(
        and(
          eq(vendors.organizationId, actor.membership.organizationId),
          eq(vendors.userId, actor.user.id)
        )
      )
      .limit(1)
  ).at(0)
  if (!vendor) throw new ForbiddenError()
  return vendor
}

async function vendorFinancialSummary(
  actor: SafeAuthContext,
  vendorId: string
) {
  const db = getDatabase()
  const organizationId = actor.membership.organizationId
  const [weightRows, paymentRows] = await Promise.all([
    db
      .select({
        weight: trips.acceptedFinalWeightMt,
        fallbackWeight: trips.finalWeightMt,
        purchaseRate: deals.purchaseRate,
      })
      .from(trips)
      .innerJoin(
        deals,
        and(
          eq(deals.organizationId, trips.organizationId),
          eq(deals.id, trips.dealId)
        )
      )
      .where(
        and(
          eq(trips.organizationId, organizationId),
          eq(deals.vendorId, vendorId)
        )
      ),
    db
      .select({ amount: payments.amount, direction: payments.direction })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.vendorId, vendorId),
          inArray(payments.status, ["POSTED", "REVERSED"])
        )
      ),
  ])
  const totalMaterialValue = formatMoney(
    weightRows.reduce((total, row) => {
      const weight = row.weight ?? row.fallbackWeight
      return weight
        ? total + parseMoney(calculateMaterialValue(weight, row.purchaseRate))
        : total
    }, 0n)
  )
  const totalReceived = formatMoney(
    paymentRows.reduce(
      (total, payment) =>
        total +
        signedPaymentAmount(payment.amount, payment.direction, "OUTGOING"),
      0n
    )
  )
  return {
    totalMaterialValue,
    totalReceived,
    pendingBalance: formatMoney(
      parseMoney(totalMaterialValue) - parseMoney(totalReceived)
    ),
  }
}

function loadStatusCondition(status: VendorLoadListInput["status"]) {
  if (status === "ACTIVE")
    return inArray(trips.status, [
      "CREATED",
      "TRUCK_ASSIGNED",
      "LOADING",
      "LOADED",
    ])
  if (status === "IN_TRANSIT") return eq(trips.status, "IN_TRANSIT")
  if (status === "DELIVERED")
    return inArray(trips.status, ["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"])
  if (status === "ARCHIVED") return eq(trips.status, "ARCHIVED")
  return undefined
}

function vendorLoadQuery() {
  return getDatabase()
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      status: trips.status,
      vehicle: vehicles.registrationNumber,
      driver: drivers.name,
      material: materials.name,
      pickup: pickupLocations.name,
      destination: destinationLocations.name,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
      challanNumber: trips.challanNumber,
      weighmentCardNumber: trips.weighmentCardNumber,
      dispatchedAt: trips.dispatchedAt,
      deliveredAt: trips.deliveredAt,
      createdAt: trips.createdAt,
      purchaseRate: deals.purchaseRate,
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
    .leftJoin(
      drivers,
      and(
        eq(drivers.organizationId, trips.organizationId),
        eq(drivers.id, trips.currentDriverId)
      )
    )
}

export async function listVendorLoads(
  actor: SafeAuthContext,
  input: VendorLoadListInput
) {
  const vendor = await requireLinkedVendor(actor)
  const organizationId = actor.membership.organizationId
  const search = input.search.trim()
  const where = and(
    eq(trips.organizationId, organizationId),
    eq(deals.vendorId, vendor.id),
    loadStatusCondition(input.status),
    input.from
      ? gte(trips.createdAt, new Date(`${input.from}T00:00:00.000Z`))
      : undefined,
    input.to
      ? lte(trips.createdAt, new Date(`${input.to}T23:59:59.999Z`))
      : undefined,
    search
      ? or(
          ilike(trips.tripNumber, `%${search}%`),
          ilike(vehicles.registrationNumber, `%${search}%`),
          ilike(pickupLocations.name, `%${search}%`),
          ilike(destinationLocations.name, `%${search}%`),
          ilike(trips.challanNumber, `%${search}%`),
          ilike(trips.weighmentCardNumber, `%${search}%`)
        )
      : undefined
  )
  const [items, [total]] = await Promise.all([
    vendorLoadQuery()
      .where(where)
      .orderBy(desc(trips.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    getDatabase()
      .select({ value: count() })
      .from(trips)
      .innerJoin(
        deals,
        and(
          eq(deals.organizationId, trips.organizationId),
          eq(deals.id, trips.dealId)
        )
      )
      .leftJoin(
        vehicles,
        and(
          eq(vehicles.organizationId, trips.organizationId),
          eq(vehicles.id, trips.currentVehicleId)
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
      .where(where),
  ])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

export async function getVendorLoad(actor: SafeAuthContext, tripId: string) {
  const vendor = await requireLinkedVendor(actor)
  const record = (
    await vendorLoadQuery()
      .where(
        and(
          eq(trips.organizationId, actor.membership.organizationId),
          eq(trips.id, tripId),
          eq(deals.vendorId, vendor.id)
        )
      )
      .limit(1)
  ).at(0)
  if (!record) throw new ForbiddenError()
  return record
}

async function vendorPayments(actor: SafeAuthContext, vendorId: string) {
  const organizationId = actor.membership.organizationId
  const items = await getDatabase()
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      type: payments.type,
      receiptNumber: payments.receiptNumber,
      status: payments.status,
      direction: payments.direction,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.vendorId, vendorId)
      )
    )
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(100)
  if (!items.length) return []
  const allocations = await getDatabase()
    .select({
      paymentId: paymentAllocations.paymentId,
      dealNumber: allocationDeals.dealNumber,
      tripNumber: allocationTrips.tripNumber,
    })
    .from(paymentAllocations)
    .innerJoin(
      payments,
      and(
        eq(payments.organizationId, paymentAllocations.organizationId),
        eq(payments.id, paymentAllocations.paymentId)
      )
    )
    .leftJoin(
      allocationDeals,
      and(
        eq(allocationDeals.organizationId, paymentAllocations.organizationId),
        eq(allocationDeals.id, paymentAllocations.dealId)
      )
    )
    .leftJoin(
      allocationTrips,
      and(
        eq(allocationTrips.organizationId, paymentAllocations.organizationId),
        eq(allocationTrips.id, paymentAllocations.tripId)
      )
    )
    .leftJoin(
      allocationTripDeals,
      and(
        eq(allocationTripDeals.organizationId, allocationTrips.organizationId),
        eq(allocationTripDeals.id, allocationTrips.dealId)
      )
    )
    .where(
      and(
        eq(paymentAllocations.organizationId, organizationId),
        eq(payments.vendorId, vendorId),
        inArray(
          paymentAllocations.paymentId,
          items.map((item) => item.id)
        ),
        or(
          eq(allocationDeals.vendorId, vendorId),
          eq(allocationTripDeals.vendorId, vendorId)
        )
      )
    )
  return items.map((item) => ({
    ...item,
    related: allocations
      .filter((allocation) => allocation.paymentId === item.id)
      .map((allocation) => allocation.tripNumber ?? allocation.dealNumber)
      .filter((label): label is string => Boolean(label)),
  }))
}

export async function listVendorPayments(actor: SafeAuthContext) {
  const vendor = await requireLinkedVendor(actor)
  const [summary, items] = await Promise.all([
    vendorFinancialSummary(actor, vendor.id),
    vendorPayments(actor, vendor.id),
  ])
  return { summary, items }
}

async function vendorDocumentRows(
  actor: SafeAuthContext,
  vendorId: string,
  input: VendorDocumentListInput,
  limit = 100
) {
  const organizationId = actor.membership.organizationId
  return getDatabase()
    .select({
      id: documents.id,
      documentType: documents.documentType,
      title: documents.title,
      currentVersionNumber: documents.currentVersionNumber,
      originalFilename: documentVersions.originalFilename,
      mimeType: documentVersions.mimeType,
      sizeBytes: documentVersions.sizeBytes,
      uploadedAt: documentVersions.createdAt,
      tripId: documentAttachments.tripId,
      tripNumber: documentTrips.tripNumber,
      dealNumber: documentDeals.dealNumber,
      paymentNumber: documentPayments.paymentNumber,
      directVendorId: documentAttachments.vendorId,
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
        eq(documentAttachments.documentId, documents.id)
      )
    )
    .leftJoin(
      documentDeals,
      and(
        eq(documentDeals.organizationId, documentAttachments.organizationId),
        eq(documentDeals.id, documentAttachments.dealId)
      )
    )
    .leftJoin(
      documentTrips,
      and(
        eq(documentTrips.organizationId, documentAttachments.organizationId),
        eq(documentTrips.id, documentAttachments.tripId)
      )
    )
    .leftJoin(
      documentTripDeals,
      and(
        eq(documentTripDeals.organizationId, documentTrips.organizationId),
        eq(documentTripDeals.id, documentTrips.dealId)
      )
    )
    .leftJoin(
      documentPayments,
      and(
        eq(documentPayments.organizationId, documentAttachments.organizationId),
        eq(documentPayments.id, documentAttachments.paymentId)
      )
    )
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.status, "ACTIVE"),
        or(
          eq(documentAttachments.vendorId, vendorId),
          eq(documentDeals.vendorId, vendorId),
          eq(documentTripDeals.vendorId, vendorId),
          eq(documentPayments.vendorId, vendorId)
        ),
        input.tripId ? eq(documentAttachments.tripId, input.tripId) : undefined,
        input.documentType === "ALL"
          ? undefined
          : eq(documents.documentType, input.documentType),
        input.from
          ? gte(
              documentVersions.createdAt,
              new Date(`${input.from}T00:00:00.000Z`)
            )
          : undefined,
        input.to
          ? lte(
              documentVersions.createdAt,
              new Date(`${input.to}T23:59:59.999Z`)
            )
          : undefined
      )
    )
    .orderBy(desc(documentVersions.createdAt))
    .limit(limit)
}

export async function listVendorDocuments(
  actor: SafeAuthContext,
  input: VendorDocumentListInput
) {
  const vendor = await requireLinkedVendor(actor)
  if (input.tripId) await getVendorLoad(actor, input.tripId)
  const [items, tripOptions] = await Promise.all([
    vendorDocumentRows(actor, vendor.id, input),
    getDatabase()
      .select({ id: trips.id, label: trips.tripNumber })
      .from(trips)
      .innerJoin(
        deals,
        and(
          eq(deals.organizationId, trips.organizationId),
          eq(deals.id, trips.dealId)
        )
      )
      .where(
        and(
          eq(trips.organizationId, actor.membership.organizationId),
          eq(deals.vendorId, vendor.id)
        )
      )
      .orderBy(desc(trips.createdAt))
      .limit(100),
  ])
  return {
    items: items.map((item) => ({
      ...item,
      relatedLabel:
        item.tripNumber ?? item.dealNumber ?? item.paymentNumber ?? vendor.name,
    })),
    tripOptions,
  }
}

export async function getVendorHome(actor: SafeAuthContext) {
  const vendor = await requireLinkedVendor(actor)
  const organizationId = actor.membership.organizationId
  const [loads, paymentsList, documentsList, summary, statusCounts] =
    await Promise.all([
      vendorLoadQuery()
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(deals.vendorId, vendor.id)
          )
        )
        .orderBy(desc(trips.createdAt))
        .limit(5),
      vendorPayments(actor, vendor.id),
      vendorDocumentRows(actor, vendor.id, { documentType: "ALL" }, 5),
      vendorFinancialSummary(actor, vendor.id),
      getDatabase()
        .select({ status: trips.status, value: count() })
        .from(trips)
        .innerJoin(
          deals,
          and(
            eq(deals.organizationId, trips.organizationId),
            eq(deals.id, trips.dealId)
          )
        )
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(deals.vendorId, vendor.id)
          )
        )
        .groupBy(trips.status),
    ])
  const countStatuses = (statuses: string[]) =>
    statusCounts
      .filter((row) => statuses.includes(row.status))
      .reduce((total, row) => total + row.value, 0)
  return {
    vendor: { id: vendor.id, name: vendor.name },
    counts: {
      active: countStatuses(["CREATED", "TRUCK_ASSIGNED", "LOADING", "LOADED"]),
      inTransit: countStatuses(["IN_TRANSIT"]),
      delivered: countStatuses(["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"]),
    },
    paymentPending: summary.pendingBalance,
    recentLoads: loads,
    recentPayments: paymentsList.slice(0, 5),
    recentDocuments: documentsList.map((item) => ({
      ...item,
      relatedLabel:
        item.tripNumber ?? item.dealNumber ?? item.paymentNumber ?? vendor.name,
    })),
  }
}

export async function getVendorProfile(actor: SafeAuthContext) {
  return requireLinkedVendor(actor)
}
