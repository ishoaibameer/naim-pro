import "@tanstack/react-start/server-only"

import { and, desc, eq, gte, ilike, lte } from "drizzle-orm"
import type { z } from "zod"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { activityEvents, users } from "@/server/db/schema"
import { requireOperationsActor } from "./shared.server"
import type { operationalActivityQuerySchema } from "./schemas"

type ActivityInput = z.infer<typeof operationalActivityQuerySchema>

export async function listOperationalActivity(
  actor: SafeAuthContext,
  input: ActivityInput
) {
  const organizationId = requireOperationsActor(actor)
  const from = input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined
  const to = input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined
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
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        input.actor ? ilike(users.name, `%${input.actor}%`) : undefined,
        input.type ? eq(activityEvents.eventType, input.type) : undefined,
        input.entity ? eq(activityEvents.entityType, input.entity) : undefined,
        from ? gte(activityEvents.createdAt, from) : undefined,
        to ? lte(activityEvents.createdAt, to) : undefined
      )
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(50)
}
