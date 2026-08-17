import "@tanstack/react-start/server-only"

import { and, desc, eq, inArray } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  companies,
  deals,
  payments,
  transporters,
  trips,
  vendors,
} from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"
import { formatMoney, parseMoney, signedPaymentAmount } from "./money"
import { computeTripFinance, getDealFinance } from "./summary.server"

export async function getVendorFinance(
  actor: SafeAuthContext,
  vendorId: string
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const vendor = (
    await db
      .select({ id: vendors.id, name: vendors.name })
      .from(vendors)
      .where(
        and(
          eq(vendors.organizationId, organizationId),
          eq(vendors.id, vendorId)
        )
      )
      .limit(1)
  ).at(0)
  if (!vendor) throw new Error("Vendor not found.")
  const dealRows = await db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      status: deals.status,
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.vendorId, vendorId)
      )
    )
    .orderBy(desc(deals.createdAt))
    .limit(50)
  const summaries = await Promise.all(
    dealRows.map((deal) => getDealFinance(actor, deal.id))
  )
  const totalPurchased = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.purchase.dealMaterialValue),
      0n
    )
  )
  const recentPayments = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      direction: payments.direction,
      status: payments.status,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.vendorId, vendorId)
      )
    )
    .orderBy(desc(payments.paymentDate))
    .limit(10)
  const paymentEffects = await db
    .select({ amount: payments.amount, direction: payments.direction })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.vendorId, vendorId),
        inArray(payments.status, ["POSTED", "REVERSED"])
      )
    )
  const totalPaid = formatMoney(
    paymentEffects.reduce(
      (total, payment) =>
        total +
        signedPaymentAmount(payment.amount, payment.direction, "OUTGOING"),
      0n
    )
  )
  return {
    ...vendor,
    totalPurchased,
    totalPaid,
    pending: formatMoney(parseMoney(totalPurchased) - parseMoney(totalPaid)),
    deals: dealRows,
    recentPayments,
  }
}

export async function getTransporterFinance(
  actor: SafeAuthContext,
  transporterId: string
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const transporter = (
    await db
      .select({ id: transporters.id, name: transporters.name })
      .from(transporters)
      .where(
        and(
          eq(transporters.organizationId, organizationId),
          eq(transporters.id, transporterId)
        )
      )
      .limit(1)
  ).at(0)
  if (!transporter) throw new Error("Transporter not found.")
  const tripRows = await db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      status: trips.status,
    })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.currentTransporterId, transporterId),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .orderBy(desc(trips.createdAt))
    .limit(50)
  const summaries = await Promise.all(
    tripRows.map((trip) =>
      db.transaction((tx) => computeTripFinance(tx, organizationId, trip.id))
    )
  )
  const freight = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.transport.freight ?? "0.00"),
      0n
    )
  )
  const paid = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.transport.paid),
      0n
    )
  )
  const recentPayments = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      direction: payments.direction,
      status: payments.status,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.transporterId, transporterId)
      )
    )
    .orderBy(desc(payments.paymentDate))
    .limit(10)
  return {
    ...transporter,
    freight,
    paid,
    pending: formatMoney(parseMoney(freight) - parseMoney(paid)),
    trips: tripRows,
    recentPayments,
  }
}

export async function getCompanyFinance(
  actor: SafeAuthContext,
  companyId: string
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const company = (
    await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, organizationId),
          eq(companies.id, companyId)
        )
      )
      .limit(1)
  ).at(0)
  if (!company) throw new Error("Company not found.")
  const tripRows = await db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      status: trips.status,
    })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.destinationCompanyId, companyId),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
    .orderBy(desc(trips.createdAt))
    .limit(50)
  const summaries = await Promise.all(
    tripRows.map((trip) =>
      db.transaction((tx) => computeTripFinance(tx, organizationId, trip.id))
    )
  )
  const billed = formatMoney(
    summaries.reduce((total, item) => total + parseMoney(item.sale.billed), 0n)
  )
  const received = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.sale.received),
      0n
    )
  )
  const recentBills = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      totalAmount: bills.totalAmount,
      status: bills.status,
      billDate: bills.billDate,
    })
    .from(bills)
    .where(
      and(
        eq(bills.organizationId, organizationId),
        eq(bills.companyId, companyId)
      )
    )
    .orderBy(desc(bills.billDate))
    .limit(10)
  const recentReceipts = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      status: payments.status,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.companyId, companyId)
      )
    )
    .orderBy(desc(payments.paymentDate))
    .limit(10)
  return {
    ...company,
    billed,
    received,
    receivable: formatMoney(parseMoney(billed) - parseMoney(received)),
    trips: tripRows,
    recentBills,
    recentReceipts,
  }
}
