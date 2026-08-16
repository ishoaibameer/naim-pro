import "@tanstack/react-start/server-only"

import { desc, eq } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { activityEvents, users } from "@/server/db/schema"
import { requireOperationsActor } from "./shared.server"

export async function listOperationalActivity(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  return getDatabase()
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      message: activityEvents.message,
      actorName: users.name,
      entityType: activityEvents.entityType,
      entityId: activityEvents.entityId,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(users.id, activityEvents.actorUserId))
    .where(eq(activityEvents.organizationId, organizationId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(50)
}
