import "@tanstack/react-start/server-only"

import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  billLines,
  bills,
  deals,
  paymentAllocations,
  payments,
  trips,
} from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import {
  calculateMaterialValue,
  formatMoney,
  parseMoney,
  signedPaymentAmount,
} from "./money"
import { evaluateSettlementReadiness } from "./settlement"

type PaymentEffect = {
  amount: string
  direction: "OUTGOING" | "INCOMING"
}

function sumEffects(
  rows: readonly PaymentEffect[],
  normalDirection: "OUTGOING" | "INCOMING"
): string {
  return formatMoney(
    rows.reduce(
      (total, row) =>
        total + signedPaymentAmount(row.amount, row.direction, normalDirection),
      0n
    )
  )
}

export async function computeTripFinance(
  tx: OperationsTransaction,
  organizationId: string,
  tripId: string
) {
  const trip = (
    await tx
      .select({
        id: trips.id,
        tripNumber: trips.tripNumber,
        dealId: trips.dealId,
        vendorId: deals.vendorId,
        companyId: trips.destinationCompanyId,
        transporterId: trips.currentTransporterId,
        status: trips.status,
        loadedWeightMt: trips.loadedWeightMt,
        finalWeightMt: trips.finalWeightMt,
        acceptedFinalWeightMt: trips.acceptedFinalWeightMt,
        purchaseRate: deals.purchaseRate,
        agreedFreightAmount: trips.agreedFreightAmount,
      })
      .from(trips)
      .innerJoin(deals, eq(deals.id, trips.dealId))
      .where(
        and(eq(trips.organizationId, organizationId), eq(trips.id, tripId))
      )
      .limit(1)
  ).at(0)
  if (!trip) throw new Error("Trip not found.")

  const dealTripRows = await tx
    .select({
      id: trips.id,
      finalWeightMt: trips.finalWeightMt,
      acceptedFinalWeightMt: trips.acceptedFinalWeightMt,
      status: trips.status,
    })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.dealId, trip.dealId),
        inArray(trips.status, [
          "DELIVERED",
          "SETTLEMENT_PENDING",
          "SETTLED",
          "ARCHIVED",
        ])
      )
    )
  const dealTripIds = dealTripRows.map((item) => item.id)
  const purchaseAmounts = dealTripRows
    .map((item) => item.acceptedFinalWeightMt ?? item.finalWeightMt)
    .filter((weight): weight is string => Boolean(weight))
    .map((weight) => calculateMaterialValue(weight, trip.purchaseRate))
  const totalMaterialValue = formatMoney(
    purchaseAmounts.reduce((total, amount) => total + parseMoney(amount), 0n)
  )
  const acceptedWeight = trip.acceptedFinalWeightMt ?? trip.finalWeightMt
  const materialValue = acceptedWeight
    ? calculateMaterialValue(acceptedWeight, trip.purchaseRate)
    : "0.00"

  const vendorEffects = await tx
    .select({
      amount: paymentAllocations.amount,
      direction: payments.direction,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(
      and(
        eq(paymentAllocations.organizationId, organizationId),
        eq(payments.vendorId, trip.vendorId),
        inArray(payments.status, ["POSTED", "REVERSED"]),
        or(
          eq(paymentAllocations.dealId, trip.dealId),
          dealTripIds.length
            ? inArray(paymentAllocations.tripId, dealTripIds)
            : undefined
        )
      )
    )
  const vendorPaid = sumEffects(vendorEffects, "OUTGOING")
  const vendorBalance = formatMoney(
    parseMoney(totalMaterialValue) - parseMoney(vendorPaid)
  )

  const transporterEffects = trip.transporterId
    ? await tx
        .select({
          amount: paymentAllocations.amount,
          direction: payments.direction,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(paymentAllocations.organizationId, organizationId),
            eq(paymentAllocations.tripId, trip.id),
            eq(payments.transporterId, trip.transporterId),
            inArray(payments.status, ["POSTED", "REVERSED"])
          )
        )
    : []
  const transporterPaid = sumEffects(transporterEffects, "OUTGOING")
  const transporterBalance = formatMoney(
    parseMoney(trip.agreedFreightAmount ?? "0.00") - parseMoney(transporterPaid)
  )

  const bill = (
    await tx
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        billDate: bills.billDate,
        status: bills.status,
        amount: billLines.lineAmount,
      })
      .from(billLines)
      .innerJoin(bills, eq(bills.id, billLines.billId))
      .where(
        and(
          eq(billLines.organizationId, organizationId),
          eq(billLines.tripId, trip.id),
          isNull(billLines.voidedAt),
          ne(bills.status, "VOID")
        )
      )
      .limit(1)
  ).at(0)
  const companyEffects = bill
    ? await tx
        .select({
          amount: paymentAllocations.amount,
          direction: payments.direction,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(paymentAllocations.organizationId, organizationId),
            eq(paymentAllocations.billId, bill.id),
            eq(payments.companyId, trip.companyId),
            inArray(payments.status, ["POSTED", "REVERSED"])
          )
        )
    : []
  const companyReceived = sumEffects(companyEffects, "INCOMING")
  const companyReceivable = formatMoney(
    parseMoney(bill?.amount ?? "0.00") - parseMoney(companyReceived)
  )
  const readiness = evaluateSettlementReadiness({
    status: trip.status,
    finalWeightMt: trip.finalWeightMt,
    purchaseAmount: materialValue,
    vendorBalance,
    freightAmount: trip.agreedFreightAmount,
    transporterBalance,
    billId: bill?.status === "ISSUED" ? bill.id : null,
    companyReceivable,
  })
  if (bill && bill.status !== "ISSUED") {
    readiness.ready = false
    readiness.blockers = [
      ...readiness.blockers.filter(
        (blocker) => blocker !== "Company bill not created"
      ),
      "Company bill is not issued",
    ]
  }
  return {
    trip,
    purchase: {
      materialValue,
      dealMaterialValue: totalMaterialValue,
      paid: vendorPaid,
      pending: vendorBalance,
    },
    transport: {
      freight: trip.agreedFreightAmount,
      paid: transporterPaid,
      pending: transporterBalance,
    },
    sale: {
      billId: bill?.id ?? null,
      billNumber: bill?.billNumber ?? null,
      billDate: bill?.billDate ?? null,
      billStatus: bill?.status ?? null,
      billed: bill?.amount ?? "0.00",
      received: companyReceived,
      receivable: companyReceivable,
    },
    readiness,
  }
}

export async function getTripFinance(actor: SafeAuthContext, tripId: string) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [summary, recentPayments] = await Promise.all([
    db.transaction((tx) => computeTripFinance(tx, organizationId, tripId)),
    db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        amount: payments.amount,
        direction: payments.direction,
        status: payments.status,
        paymentDate: payments.paymentDate,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.organizationId, organizationId),
          eq(paymentAllocations.tripId, tripId)
        )
      )
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(10),
  ])
  return { ...summary, recentPayments }
}

export async function getDealFinance(actor: SafeAuthContext, dealId: string) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const tripRows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(
      and(eq(trips.organizationId, organizationId), eq(trips.dealId, dealId))
    )
  const summaries = await Promise.all(
    tripRows.map((trip) =>
      db.transaction((tx) => computeTripFinance(tx, organizationId, trip.id))
    )
  )
  const purchase = summaries.at(0)?.purchase ?? {
    materialValue: "0.00",
    dealMaterialValue: "0.00",
    paid: "0.00",
    pending: "0.00",
  }
  const freight = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.transport.freight ?? "0.00"),
      0n
    )
  )
  const transportPaid = formatMoney(
    summaries.reduce(
      (total, item) => total + parseMoney(item.transport.paid),
      0n
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
  const recentPayments = tripRows.length
    ? await db
        .selectDistinct({
          id: payments.id,
          paymentNumber: payments.paymentNumber,
          amount: payments.amount,
          direction: payments.direction,
          status: payments.status,
          paymentDate: payments.paymentDate,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(paymentAllocations.organizationId, organizationId),
            or(
              eq(paymentAllocations.dealId, dealId),
              inArray(
                paymentAllocations.tripId,
                tripRows.map((trip) => trip.id)
              )
            )
          )
        )
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
        .limit(10)
    : []
  return {
    purchase,
    transport: {
      freight,
      paid: transportPaid,
      pending: formatMoney(parseMoney(freight) - parseMoney(transportPaid)),
    },
    sale: {
      billed,
      received,
      receivable: formatMoney(parseMoney(billed) - parseMoney(received)),
    },
    recentPayments,
  }
}
