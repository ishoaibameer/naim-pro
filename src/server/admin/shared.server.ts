import "@tanstack/react-start/server-only"

import { and, eq, sql } from "drizzle-orm"

import type { Database } from "@/server/db/index.server"
import { activityEvents, auditEvents } from "@/server/db/schema"
import { normalizePhone } from "@/server/auth/phone"
import { requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"

export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]

export function requireAdmin(actor: SafeAuthContext): string {
  requireRole(actor, ["ADMIN"])
  return actor.membership.organizationId
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN")
}

export function normalizeRegistration(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function optionalPhone(value: string): string | null {
  return value.trim() ? normalizePhone(value) : null
}

export function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export async function lockMasterName(
  transaction: DatabaseTransaction,
  organizationId: string,
  entityType: "VENDOR" | "LOCATION" | "MATERIAL",
  normalizedName: string
): Promise<void> {
  const lockKey = `${organizationId}:${entityType}:${normalizedName}`
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  )
}

export async function recordMutation(
  transaction: DatabaseTransaction,
  actor: SafeAuthContext,
  input: {
    action: string
    message: string
    entityType: string
    entityId: string
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
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
  })
  await transaction.insert(auditEvents).values({
    ...base,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
  })
}

export function statusFilter<TColumn>(
  column: TColumn,
  status: "ALL" | "ACTIVE" | "INACTIVE"
) {
  return status === "ALL" ? undefined : eq(column as never, status)
}

export function optimisticWhere<TIdColumn, TOrgColumn, TVersionColumn>(
  idColumn: TIdColumn,
  organizationColumn: TOrgColumn,
  versionColumn: TVersionColumn,
  input: { id: string; organizationId: string; version: number }
) {
  return and(
    eq(idColumn as never, input.id),
    eq(organizationColumn as never, input.organizationId),
    eq(versionColumn as never, input.version)
  )
}

export const incrementVersion = (column: unknown) => sql`${column as never} + 1`
