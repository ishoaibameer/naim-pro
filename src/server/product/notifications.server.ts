import "@tanstack/react-start/server-only"

import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm"

import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { notifications, organizations, trips } from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"

async function ensureDelayedNotifications(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const organization = (
    await db
      .select({ hours: organizations.expectedTransitDurationHours })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
  ).at(0)
  if (!organization) throw new ForbiddenError()
  const cutoff = new Date(Date.now() - organization.hours * 60 * 60 * 1000)
  const delayed = await db
    .select({ id: trips.id, tripNumber: trips.tripNumber })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.status, "IN_TRANSIT"),
        isNotNull(trips.dispatchedAt),
        lt(trips.dispatchedAt, cutoff)
      )
    )
    .limit(100)
  if (!delayed.length) return
  await db
    .insert(notifications)
    .values(
      delayed.map((trip) => ({
        organizationId,
        recipientUserId: actor.user.id,
        recipientMembershipId: actor.membership.id,
        type: "WARNING" as const,
        title: "Trip delayed",
        message: `Trip ${trip.tripNumber} has exceeded the expected transit duration.`,
        entityType: "TRIP",
        entityId: trip.id,
        dedupeKey: `TRIP_DELAYED:${trip.id}:${actor.membership.id}`,
      }))
    )
    .onConflictDoNothing()
}

export async function listNotifications(
  actor: SafeAuthContext,
  tab: "UNREAD" | "READ"
) {
  const organizationId = requireOperationsActor(actor)
  await ensureDelayedNotifications(actor)
  return getDatabase()
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientMembershipId, actor.membership.id),
        tab === "UNREAD"
          ? isNull(notifications.readAt)
          : isNotNull(notifications.readAt)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100)
}

export async function markNotificationRead(actor: SafeAuthContext, id: string) {
  const organizationId = requireOperationsActor(actor)
  const updated = (
    await getDatabase()
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.recipientMembershipId, actor.membership.id),
          eq(notifications.id, id),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id })
  ).at(0)
  if (!updated) throw new ForbiddenError()
  return updated
}

export async function markAllNotificationsRead(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  await getDatabase()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientMembershipId, actor.membership.id),
        isNull(notifications.readAt)
      )
    )
  return { success: true }
}
