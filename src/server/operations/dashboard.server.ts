import "@tanstack/react-start/server-only"

import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { activityEvents, deals, trips } from "@/server/db/schema"
import { requireOperationsActor } from "./shared.server"

export async function getOperationsDashboard(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [
    activeDeals,
    loading,
    inTransit,
    deliveredToday,
    attention,
    recentTrips,
    recentActivity,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, organizationId),
          eq(deals.status, "ACTIVE")
        )
      ),
    db
      .select({ value: count() })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          inArray(trips.status, ["LOADING", "LOADED"])
        )
      ),
    db
      .select({ value: count() })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          eq(trips.status, "IN_TRANSIT")
        )
      ),
    db
      .select({ value: count() })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          eq(trips.status, "DELIVERED"),
          gte(trips.deliveredAt, startOfToday)
        )
      ),
    db
      .select({ value: count() })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          eq(trips.status, "DELIVERED"),
          sql`${trips.loadedWeightMt} > 0`,
          sql`abs((${trips.loadedWeightMt} - ${trips.finalWeightMt}) / ${trips.loadedWeightMt} * 100) > 1`
        )
      ),
    db
      .select({
        id: trips.id,
        tripNumber: trips.tripNumber,
        status: trips.status,
        loadedWeightMt: trips.loadedWeightMt,
        dispatchedAt: trips.dispatchedAt,
        createdAt: trips.createdAt,
      })
      .from(trips)
      .where(eq(trips.organizationId, organizationId))
      .orderBy(desc(trips.updatedAt))
      .limit(6),
    db
      .select({
        id: activityEvents.id,
        message: activityEvents.message,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(eq(activityEvents.organizationId, organizationId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(8),
  ])
  const attentionItems = await db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      loadedWeightMt: trips.loadedWeightMt,
      finalWeightMt: trips.finalWeightMt,
    })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.status, "DELIVERED"),
        sql`${trips.loadedWeightMt} > 0`,
        sql`abs((${trips.loadedWeightMt} - ${trips.finalWeightMt}) / ${trips.loadedWeightMt} * 100) > 1`
      )
    )
    .orderBy(desc(trips.deliveredAt))
    .limit(5)
  return {
    counts: {
      activeDeals: activeDeals[0].value,
      loading: loading[0].value,
      inTransit: inTransit[0].value,
      deliveredToday: deliveredToday[0].value,
      needsAttention: attention[0].value,
    },
    recentTrips,
    recentActivity,
    attentionItems,
  }
}
