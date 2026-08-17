import "@tanstack/react-start/server-only"

import { and, eq, inArray } from "drizzle-orm"

import { memberships, notifications, users } from "@/server/db/schema"
import type { OperationsTransaction } from "@/server/operations/shared.server"

const notificationActions: Record<
  string,
  | {
      type: "INFO" | "WARNING" | "ACTION_REQUIRED"
      title: string
    }
  | undefined
> = {
  TRIP_WEIGHT_ISSUE_DETECTED: {
    type: "WARNING",
    title: "Weight difference needs review",
  },
  PAYMENT_POSTED: { type: "INFO", title: "Payment recorded" },
  TRIP_DELIVERED: { type: "INFO", title: "Delivery confirmed" },
  DOCUMENT_UPLOADED: { type: "INFO", title: "Document uploaded" },
  DOCUMENT_VERSION_UPLOADED: {
    type: "INFO",
    title: "Document version uploaded",
  },
  TRIP_SETTLEMENT_STARTED: {
    type: "ACTION_REQUIRED",
    title: "Settlement review started",
  },
}

export async function insertOperationalNotifications(
  transaction: OperationsTransaction,
  input: {
    organizationId: string
    action: string
    message: string
    entityType: string
    entityId: string
  }
) {
  const config = notificationActions[input.action]
  if (!config) return
  const recipients = await transaction
    .select({ membershipId: memberships.id, userId: users.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        inArray(memberships.role, ["ADMIN", "MEMBER"]),
        eq(memberships.status, "ACTIVE"),
        eq(users.status, "ACTIVE")
      )
    )
  if (!recipients.length) return
  await transaction
    .insert(notifications)
    .values(
      recipients.map((recipient) => ({
        organizationId: input.organizationId,
        recipientUserId: recipient.userId,
        recipientMembershipId: recipient.membershipId,
        type: config.type,
        title: config.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: `${input.action}:${input.entityId}:${recipient.membershipId}`,
      }))
    )
    .onConflictDoNothing()
}
