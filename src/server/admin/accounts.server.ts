import "@tanstack/react-start/server-only"

import { and, eq, isNull, sql } from "drizzle-orm"

import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { memberships, sessions, users } from "@/server/db/schema"

import { recordMutation, requireAdmin } from "./shared.server"

export async function setManagedAccountStatus(
  actor: SafeAuthContext,
  input: { userId: string; status: "ACTIVE" | "INACTIVE"; version: number }
) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  await getDatabase().transaction(async (transaction) => {
    const current = (
      await transaction
        .select({
          status: users.status,
          version: users.version,
          role: memberships.role,
        })
        .from(users)
        .innerJoin(
          memberships,
          and(
            eq(memberships.userId, users.id),
            eq(memberships.organizationId, organizationId)
          )
        )
        .where(
          and(eq(users.id, input.userId), eq(users.version, input.version))
        )
        .limit(1)
    ).at(0)
    if (!current || current.role === "ADMIN") throw new ForbiddenError()
    await transaction
      .update(users)
      .set({
        status: input.status,
        version: sql`${users.version} + 1`,
        updatedAt: now,
      })
      .where(and(eq(users.id, input.userId), eq(users.version, input.version)))
    if (input.status === "INACTIVE") {
      await transaction
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(eq(sessions.userId, input.userId), isNull(sessions.revokedAt))
        )
    }
    await recordMutation(transaction, actor, {
      action: input.status === "ACTIVE" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      message: `${current.role} login ${input.status === "ACTIVE" ? "activated" : "deactivated"}.`,
      entityType: "USER",
      entityId: input.userId,
      before: current,
      after: {
        status: input.status,
        version: current.version + 1,
        role: current.role,
      },
    })
  })
}
