import "@tanstack/react-start/server-only"

import {
  activityEvents,
  auditEvents,
  tripStatusEvents,
} from "@/server/db/schema"
import type { Database } from "@/server/db/index.server"
import { requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import type { TripStatus } from "./trip-state"
import { insertOperationalNotifications } from "@/server/product/notifications-write.server"

export type OperationsTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]

export function requireOperationsActor(actor: SafeAuthContext): string {
  requireRole(actor, ["ADMIN", "MEMBER"])
  return actor.membership.organizationId
}

export function normalizeReference(value: string): string {
  return value.trim().toLocaleUpperCase("en-IN").replace(/\s+/g, "")
}

export async function recordOperationalMutation(
  transaction: OperationsTransaction,
  actor: SafeAuthContext,
  input: {
    action: string
    message: string
    entityType:
      | "DEAL"
      | "TRIP"
      | "PAYMENT"
      | "BILL"
      | "DOCUMENT"
      | "CUSTOM_FIELD"
      | "DRIVER_EXPENSE"
    entityId: string
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    reason?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const base = {
    organizationId: actor.membership.organizationId,
    actorUserId: actor.user.id,
    actorMembershipId: actor.membership.id,
    entityType: input.entityType,
    entityId: input.entityId,
  }
  await transaction.insert(activityEvents).values({
    ...base,
    eventType: input.action,
    message: input.message,
    metadata: input.metadata ?? {},
  })
  await transaction.insert(auditEvents).values({
    ...base,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  })
  await insertOperationalNotifications(transaction, {
    organizationId: actor.membership.organizationId,
    action: input.action,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId,
  })
}

export async function recordTripStatus(
  transaction: OperationsTransaction,
  actor: SafeAuthContext,
  input: {
    tripId: string
    fromStatus: TripStatus | null
    toStatus: TripStatus
    reason?: string | null
  }
): Promise<void> {
  await transaction.insert(tripStatusEvents).values({
    organizationId: actor.membership.organizationId,
    tripId: input.tripId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedByMembershipId: actor.membership.id,
    reason: input.reason ?? null,
  })
}
