import "@tanstack/react-start/server-only"

import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { activityEvents, users } from "@/server/db/schema"

import type { z } from "zod"
import type { activityQuerySchema } from "./schemas"
import { requireAdmin } from "./shared.server"

type ActivityQuery = z.infer<typeof activityQuerySchema>

export async function listActivity(
  actor: SafeAuthContext,
  query: ActivityQuery
) {
  const organizationId = requireAdmin(actor)
  const search = query.search.trim()
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null
  return getDatabase()
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      message: activityEvents.message,
      entityType: activityEvents.entityType,
      entityId: activityEvents.entityId,
      actorName: users.name,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(users.id, activityEvents.actorUserId))
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        query.action ? eq(activityEvents.eventType, query.action) : undefined,
        query.entity ? eq(activityEvents.entityType, query.entity) : undefined,
        from ? gte(activityEvents.createdAt, from) : undefined,
        to ? lte(activityEvents.createdAt, to) : undefined,
        search
          ? or(
              ilike(users.name, `%${search}%`),
              ilike(activityEvents.message, `%${search}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
}
