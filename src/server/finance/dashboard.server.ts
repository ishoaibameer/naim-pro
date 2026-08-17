import "@tanstack/react-start/server-only"

import { and, desc, eq, inArray } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { deals, trips } from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"
import { formatMoney, parseMoney } from "./money"
import { computeTripFinance, getDealFinance } from "./summary.server"

export async function getFinanceDashboard(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [dealRows, tripRows] = await Promise.all([
    db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, organizationId),
          inArray(deals.status, ["ACTIVE", "FULFILLED"])
        )
      ),
    db
      .select({ id: trips.id })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          inArray(trips.status, ["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"])
        )
      )
      .orderBy(desc(trips.updatedAt))
      .limit(100),
  ])
  const [dealSummaries, tripSummaries] = await Promise.all([
    Promise.all(dealRows.map((deal) => getDealFinance(actor, deal.id))),
    Promise.all(
      tripRows.map((trip) =>
        db.transaction((tx) => computeTripFinance(tx, organizationId, trip.id))
      )
    ),
  ])
  const vendorPending = formatMoney(
    dealSummaries.reduce(
      (total, item) => total + parseMoney(item.purchase.pending),
      0n
    )
  )
  const transporterPending = formatMoney(
    tripSummaries.reduce(
      (total, item) => total + parseMoney(item.transport.pending),
      0n
    )
  )
  const companyReceivable = formatMoney(
    tripSummaries.reduce(
      (total, item) => total + parseMoney(item.sale.receivable),
      0n
    )
  )
  const attention = tripSummaries
    .filter(
      (item) =>
        !item.readiness.ready || item.trip.status === "SETTLEMENT_PENDING"
    )
    .slice(0, 8)
    .map((item) => ({
      id: item.trip.id,
      tripNumber: item.trip.tripNumber,
      status: item.trip.status,
      ready: item.readiness.ready,
      blockers: item.readiness.blockers.slice(0, 3),
    }))
  return { vendorPending, transporterPending, companyReceivable, attention }
}
