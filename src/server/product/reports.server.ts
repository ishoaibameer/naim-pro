import "@tanstack/react-start/server-only"

import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  billLines,
  companies,
  deals,
  drivers,
  locations,
  memberships,
  payments,
  transporters,
  trips,
  users,
  vehicles,
  vendors,
} from "@/server/db/schema"
import {
  formatMoney,
  parseMoney,
  signedPaymentAmount,
} from "@/server/finance/money"
import { requireOperationsActor } from "@/server/operations/shared.server"
import {
  formatScaledDecimal,
  parseExactDecimal,
} from "@/server/operations/decimal"
import type { ReportFilterInput } from "./schemas"

const pickupLocations = alias(locations, "report_pickup_locations")
const destinationLocations = alias(locations, "report_destination_locations")
const MAX_REPORT_ROWS = 1000

function reportDate(input: ReportFilterInput) {
  return {
    from: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
    to: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
  }
}

function tripFilters(organizationId: string, input: ReportFilterInput) {
  const { from, to } = reportDate(input)
  const effectiveDate = sql<Date>`coalesce(${trips.deliveredAt}, ${trips.dispatchedAt}, ${trips.createdAt})`
  return and(
    eq(trips.organizationId, organizationId),
    input.status === "ALL" ? undefined : eq(trips.status, input.status),
    input.vendorId ? eq(deals.vendorId, input.vendorId) : undefined,
    input.vehicleId ? eq(trips.currentVehicleId, input.vehicleId) : undefined,
    input.driverId ? eq(trips.currentDriverId, input.driverId) : undefined,
    input.transporterId
      ? eq(trips.currentTransporterId, input.transporterId)
      : undefined,
    input.companyId
      ? eq(trips.destinationCompanyId, input.companyId)
      : undefined,
    input.pickupId ? eq(trips.pickupLocationId, input.pickupId) : undefined,
    input.destinationId
      ? eq(trips.destinationLocationId, input.destinationId)
      : undefined,
    from ? gte(effectiveDate, from) : undefined,
    to ? lte(effectiveDate, to) : undefined
  )
}

export async function getReportMasters(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [
    vendorRows,
    vehicleRows,
    driverRows,
    transporterRows,
    companyRows,
    locationRows,
    memberRows,
  ] = await Promise.all([
    db
      .select({ id: vendors.id, label: vendors.name })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId))
      .orderBy(asc(vendors.name)),
    db
      .select({ id: vehicles.id, label: vehicles.registrationNumber })
      .from(vehicles)
      .where(eq(vehicles.organizationId, organizationId))
      .orderBy(asc(vehicles.registrationNumber)),
    db
      .select({ id: drivers.id, label: drivers.name })
      .from(drivers)
      .where(eq(drivers.organizationId, organizationId))
      .orderBy(asc(drivers.name)),
    db
      .select({ id: transporters.id, label: transporters.name })
      .from(transporters)
      .where(eq(transporters.organizationId, organizationId))
      .orderBy(asc(transporters.name)),
    db
      .select({ id: companies.id, label: companies.name })
      .from(companies)
      .where(eq(companies.organizationId, organizationId))
      .orderBy(asc(companies.name)),
    db
      .select({ id: locations.id, label: locations.name, type: locations.type })
      .from(locations)
      .where(eq(locations.organizationId, organizationId))
      .orderBy(asc(locations.name)),
    db
      .select({ id: memberships.id, label: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          inArray(memberships.role, ["ADMIN", "MEMBER"])
        )
      )
      .orderBy(asc(users.name)),
  ])
  return {
    vendors: vendorRows,
    vehicles: vehicleRows,
    drivers: driverRows,
    transporters: transporterRows,
    companies: companyRows,
    pickupLocations: locationRows.filter((item) => item.type !== "DESTINATION"),
    destinationLocations: locationRows.filter((item) => item.type !== "PICKUP"),
    members: memberRows,
  }
}

async function tripReport(organizationId: string, input: ReportFilterInput) {
  return getDatabase()
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      vehicle: vehicles.registrationNumber,
      vendor: vendors.name,
      company: companies.name,
      driver: drivers.name,
      transporter: transporters.name,
      pickup: pickupLocations.name,
      destination: destinationLocations.name,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
      differenceMt: sql<
        string | null
      >`case when ${trips.loadedWeightMt} is not null and ${trips.finalWeightMt} is not null then (${trips.loadedWeightMt} - ${trips.finalWeightMt})::text else null end`,
      status: trips.status,
      dispatchedAt: trips.dispatchedAt,
      deliveredAt: trips.deliveredAt,
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
        eq(vendors.organizationId, trips.organizationId),
        eq(vendors.id, deals.vendorId)
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
    .where(tripFilters(organizationId, input))
    .orderBy(
      desc(
        sql`coalesce(${trips.deliveredAt}, ${trips.dispatchedAt}, ${trips.createdAt})`
      )
    )
    .limit(MAX_REPORT_ROWS)
}

type Aggregate = {
  id: string
  name: string
  trips: number
  weightMilli: bigint
  totalCents: bigint
  paidCents: bigint
}

function aggregateRows(
  rows: Array<{
    id: string
    name: string
    weight: string | null
    total: string | null
  }>
) {
  const groups = new Map<string, Aggregate>()
  for (const row of rows) {
    const current = groups.get(row.id) ?? {
      id: row.id,
      name: row.name,
      trips: 0,
      weightMilli: 0n,
      totalCents: 0n,
      paidCents: 0n,
    }
    current.trips += 1
    if (row.weight)
      current.weightMilli += parseExactDecimal(row.weight, {
        scale: 3,
        integerDigits: 9,
      })
    if (row.total) current.totalCents += parseMoney(row.total)
    groups.set(row.id, current)
  }
  return groups
}

async function paymentEffects(
  organizationId: string,
  input: ReportFilterInput,
  party: "VENDOR" | "TRANSPORTER" | "COMPANY"
) {
  const { from, to } = reportDate(input)
  return getDatabase()
    .select({
      partyId:
        party === "VENDOR"
          ? payments.vendorId
          : party === "TRANSPORTER"
            ? payments.transporterId
            : payments.companyId,
      amount: payments.amount,
      direction: payments.direction,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        inArray(payments.status, ["POSTED", "REVERSED"]),
        party === "VENDOR"
          ? sql`${payments.vendorId} is not null`
          : party === "TRANSPORTER"
            ? sql`${payments.transporterId} is not null`
            : sql`${payments.companyId} is not null`,
        from
          ? gte(payments.paymentDate, from.toISOString().slice(0, 10))
          : undefined,
        to
          ? lte(payments.paymentDate, to.toISOString().slice(0, 10))
          : undefined
      )
    )
}

async function vendorReport(organizationId: string, input: ReportFilterInput) {
  const rows = await getDatabase()
    .select({
      id: vendors.id,
      name: vendors.name,
      weight: sql<
        string | null
      >`coalesce(${trips.acceptedFinalWeightMt}, ${trips.finalWeightMt})::text`,
      total: sql<
        string | null
      >`case when coalesce(${trips.acceptedFinalWeightMt}, ${trips.finalWeightMt}) is not null then (coalesce(${trips.acceptedFinalWeightMt}, ${trips.finalWeightMt}) * ${deals.purchaseRate})::numeric(16,2)::text else null end`,
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
        eq(vendors.organizationId, trips.organizationId),
        eq(vendors.id, deals.vendorId)
      )
    )
    .where(
      and(
        tripFilters(organizationId, input),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .limit(MAX_REPORT_ROWS)
  const groups = aggregateRows(rows)
  for (const payment of await paymentEffects(organizationId, input, "VENDOR")) {
    if (!payment.partyId || !groups.has(payment.partyId)) continue
    groups.get(payment.partyId)!.paidCents += signedPaymentAmount(
      payment.amount,
      payment.direction,
      "OUTGOING"
    )
  }
  return [...groups.values()].map((item) => ({
    id: item.id,
    vendor: item.name,
    trips: item.trips,
    deliveredWeightMt: formatScaledDecimal(item.weightMilli, 3),
    materialValue: formatMoney(item.totalCents),
    paid: formatMoney(item.paidCents),
    pending: formatMoney(item.totalCents - item.paidCents),
  }))
}

async function transporterReport(
  organizationId: string,
  input: ReportFilterInput
) {
  const rows = await getDatabase()
    .select({
      id: transporters.id,
      name: transporters.name,
      weight: trips.finalWeightMt,
      total: trips.agreedFreightAmount,
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
      transporters,
      and(
        eq(transporters.organizationId, trips.organizationId),
        eq(transporters.id, trips.currentTransporterId)
      )
    )
    .where(
      and(
        tripFilters(organizationId, input),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .limit(MAX_REPORT_ROWS)
  const groups = aggregateRows(rows)
  for (const payment of await paymentEffects(
    organizationId,
    input,
    "TRANSPORTER"
  )) {
    if (!payment.partyId || !groups.has(payment.partyId)) continue
    groups.get(payment.partyId)!.paidCents += signedPaymentAmount(
      payment.amount,
      payment.direction,
      "OUTGOING"
    )
  }
  return [...groups.values()].map((item) => ({
    id: item.id,
    transporter: item.name,
    trips: item.trips,
    freight: formatMoney(item.totalCents),
    paid: formatMoney(item.paidCents),
    pending: formatMoney(item.totalCents - item.paidCents),
  }))
}

async function companyReport(organizationId: string, input: ReportFilterInput) {
  const tripRows = await getDatabase()
    .select({
      id: companies.id,
      name: companies.name,
      weight: trips.finalWeightMt,
      total: sql<
        string | null
      >`case when ${bills.id} is not null then ${billLines.lineAmount} else null end`,
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
      companies,
      and(
        eq(companies.organizationId, trips.organizationId),
        eq(companies.id, trips.destinationCompanyId)
      )
    )
    .leftJoin(
      billLines,
      and(
        eq(billLines.organizationId, trips.organizationId),
        eq(billLines.tripId, trips.id),
        sql`${billLines.voidedAt} is null`
      )
    )
    .leftJoin(
      bills,
      and(
        eq(bills.organizationId, trips.organizationId),
        eq(bills.id, billLines.billId),
        ne(bills.status, "VOID")
      )
    )
    .where(
      and(
        tripFilters(organizationId, input),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .limit(MAX_REPORT_ROWS)
  const groups = aggregateRows(tripRows)
  for (const payment of await paymentEffects(
    organizationId,
    input,
    "COMPANY"
  )) {
    if (!payment.partyId || !groups.has(payment.partyId)) continue
    groups.get(payment.partyId)!.paidCents += signedPaymentAmount(
      payment.amount,
      payment.direction,
      "INCOMING"
    )
  }
  return [...groups.values()].map((item) => ({
    id: item.id,
    company: item.name,
    tripsDelivered: item.trips,
    finalWeightMt: formatScaledDecimal(item.weightMilli, 3),
    billed: formatMoney(item.totalCents),
    received: formatMoney(item.paidCents),
    receivable: formatMoney(item.totalCents - item.paidCents),
  }))
}

async function paymentReport(organizationId: string, input: ReportFilterInput) {
  const { from, to } = reportDate(input)
  return getDatabase()
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      paymentDate: payments.paymentDate,
      party: sql<string>`coalesce(${vendors.name}, ${transporters.name}, ${companies.name})`,
      partyType: sql<
        "VENDOR" | "TRANSPORTER" | "COMPANY"
      >`case when ${payments.vendorId} is not null then 'VENDOR' when ${payments.transporterId} is not null then 'TRANSPORTER' else 'COMPANY' end`,
      amount: payments.amount,
      direction: payments.direction,
      type: payments.type,
      status: payments.status,
      recordedBy: users.name,
      receipt: payments.receiptNumber,
    })
    .from(payments)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, payments.organizationId),
        eq(memberships.id, payments.recordedByMembershipId)
      )
    )
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(
      vendors,
      and(
        eq(vendors.organizationId, payments.organizationId),
        eq(vendors.id, payments.vendorId)
      )
    )
    .leftJoin(
      transporters,
      and(
        eq(transporters.organizationId, payments.organizationId),
        eq(transporters.id, payments.transporterId)
      )
    )
    .leftJoin(
      companies,
      and(
        eq(companies.organizationId, payments.organizationId),
        eq(companies.id, payments.companyId)
      )
    )
    .where(
      and(
        eq(payments.organizationId, organizationId),
        input.partyType === "ALL"
          ? undefined
          : input.partyType === "VENDOR"
            ? sql`${payments.vendorId} is not null`
            : input.partyType === "TRANSPORTER"
              ? sql`${payments.transporterId} is not null`
              : sql`${payments.companyId} is not null`,
        input.partyId
          ? or(
              eq(payments.vendorId, input.partyId),
              eq(payments.transporterId, input.partyId),
              eq(payments.companyId, input.partyId)
            )
          : undefined,
        input.direction === "ALL"
          ? undefined
          : eq(payments.direction, input.direction),
        input.paymentType === "ALL"
          ? undefined
          : eq(payments.type, input.paymentType),
        input.memberId
          ? eq(payments.recordedByMembershipId, input.memberId)
          : undefined,
        from
          ? gte(payments.paymentDate, from.toISOString().slice(0, 10))
          : undefined,
        to
          ? lte(payments.paymentDate, to.toISOString().slice(0, 10))
          : undefined
      )
    )
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(MAX_REPORT_ROWS)
}

async function weightReport(organizationId: string, input: ReportFilterInput) {
  const rows = await getDatabase()
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      vehicle: vehicles.registrationNumber,
      vendor: vendors.name,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
      differenceMt: sql<string>`(${trips.loadedWeightMt} - ${trips.finalWeightMt})::text`,
      differencePct: sql<string>`case when ${trips.loadedWeightMt} = 0 then '0' else ((${trips.loadedWeightMt} - ${trips.finalWeightMt}) / ${trips.loadedWeightMt} * 100)::numeric(9,4)::text end`,
      deliveredAt: trips.deliveredAt,
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
        eq(vendors.organizationId, trips.organizationId),
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
    .where(
      and(
        tripFilters(organizationId, input),
        sql`${trips.loadedWeightMt} is not null`,
        sql`${trips.finalWeightMt} is not null`,
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .orderBy(desc(trips.deliveredAt))
    .limit(MAX_REPORT_ROWS)
  return rows.filter(
    (row) => Math.abs(Number(row.differencePct)) >= input.minDifferencePct
  )
}

export async function getReport(
  actor: SafeAuthContext,
  input: ReportFilterInput
) {
  const organizationId = requireOperationsActor(actor)
  if (input.report === "TRIPS")
    return {
      type: input.report,
      rows: await tripReport(organizationId, input),
    } as const
  if (input.report === "VENDORS")
    return {
      type: input.report,
      rows: await vendorReport(organizationId, input),
    } as const
  if (input.report === "TRANSPORTERS")
    return {
      type: input.report,
      rows: await transporterReport(organizationId, input),
    } as const
  if (input.report === "COMPANIES")
    return {
      type: input.report,
      rows: await companyReport(organizationId, input),
    } as const
  if (input.report === "PAYMENTS")
    return {
      type: input.report,
      rows: await paymentReport(organizationId, input),
    } as const
  return {
    type: input.report,
    rows: await weightReport(organizationId, input),
  } as const
}
