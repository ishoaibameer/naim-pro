import "@tanstack/react-start/server-only"

import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import {
  createUserAccount,
  resetUserPassword,
} from "@/server/auth/admin.server"
import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { memberships, sessions, users } from "@/server/db/schema"

import type { ListQuery } from "./schemas"
import { recordMutation, requireAdmin } from "./shared.server"

export async function listMembers(actor: SafeAuthContext, query: ListQuery) {
  const organizationId = requireAdmin(actor)
  const db = getDatabase()
  const offset = (query.page - 1) * query.pageSize
  const search = query.search.trim()
  const conditions = [
    eq(memberships.organizationId, organizationId),
    eq(memberships.role, "MEMBER"),
    query.status === "ALL" ? undefined : eq(users.status, query.status),
    search
      ? or(
          ilike(users.name, `%${search}%`),
          ilike(users.phoneE164, `%${search.replace(/[^0-9+]/g, "")}%`)
        )
      : undefined,
  ].filter((condition) => condition !== undefined)

  const where = and(...conditions)
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phoneE164,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        version: users.version,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(where),
  ])
  return {
    items,
    total: total.value,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getMember(actor: SafeAuthContext, id: string) {
  const organizationId = requireAdmin(actor)
  const member = (
    await getDatabase()
      .select({
        id: users.id,
        name: users.name,
        phone: users.phoneE164,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        mustChangePassword: users.mustChangePassword,
        version: users.version,
      })
      .from(users)
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, users.id),
          eq(memberships.organizationId, organizationId),
          eq(memberships.role, "MEMBER")
        )
      )
      .where(eq(users.id, id))
      .limit(1)
  ).at(0)
  if (!member) throw new ForbiddenError()
  return member
}

export async function createMember(
  actor: SafeAuthContext,
  input: {
    name: string
    phone: string
    password: string
    status: "ACTIVE" | "INACTIVE"
  }
) {
  const organizationId = requireAdmin(actor)
  const created = await createUserAccount(actor, {
    name: input.name,
    phone: input.phone,
    password: input.password,
    role: "MEMBER",
    organizationId,
  })
  if (input.status === "INACTIVE") {
    await setMemberStatus(actor, {
      userId: created.user.id,
      status: "INACTIVE",
      version: 1,
    })
  }
  return created
}

export async function setMemberStatus(
  actor: SafeAuthContext,
  input: { userId: string; status: "ACTIVE" | "INACTIVE"; version: number }
) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  await getDatabase().transaction(async (transaction) => {
    const target = (
      await transaction
        .select({ id: users.id, status: users.status, version: users.version })
        .from(users)
        .innerJoin(
          memberships,
          and(
            eq(memberships.userId, users.id),
            eq(memberships.organizationId, organizationId),
            eq(memberships.role, "MEMBER")
          )
        )
        .where(
          and(eq(users.id, input.userId), eq(users.version, input.version))
        )
        .limit(1)
    ).at(0)
    if (!target) throw new Error("Member changed; refresh and try again.")

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
      message: `Member ${input.status === "ACTIVE" ? "activated" : "deactivated"}.`,
      entityType: "USER",
      entityId: input.userId,
      before: { status: target.status, version: target.version },
      after: { status: input.status, version: target.version + 1 },
    })
  })
}

export async function resetMemberPassword(
  actor: SafeAuthContext,
  input: { userId: string; password: string }
) {
  await getMember(actor, input.userId)
  await resetUserPassword(actor, input.userId, input.password)
}
