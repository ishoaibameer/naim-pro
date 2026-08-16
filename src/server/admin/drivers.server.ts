import "@tanstack/react-start/server-only"

import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import {
  insertPreparedUserAccount,
  prepareUserAccount,
} from "@/server/auth/admin.server"
import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  drivers,
  driverTransporterAssignments,
  transporters,
  users,
} from "@/server/db/schema"

import type { ListQuery } from "./schemas"
import {
  normalizeName,
  optionalPhone,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface CreateDriverInput {
  name: string
  phone: string
  transporterId: string
  status: "ACTIVE" | "INACTIVE"
  loginEnabled: boolean
  loginName: string
  loginPhone: string
  temporaryPassword: string
}

export async function listDrivers(actor: SafeAuthContext, query: ListQuery) {
  const organizationId = requireAdmin(actor)
  const db = getDatabase()
  const search = query.search.trim()
  const where = and(
    eq(drivers.organizationId, organizationId),
    query.status === "ALL" ? undefined : eq(drivers.status, query.status),
    search
      ? or(
          ilike(drivers.name, `%${search}%`),
          ilike(drivers.phoneE164, `%${search.replace(/[^0-9+]/g, "")}%`),
          ilike(transporters.name, `%${search}%`)
        )
      : undefined
  )
  const base = db
    .select({
      id: drivers.id,
      name: drivers.name,
      phone: drivers.phoneE164,
      status: drivers.status,
      userId: drivers.userId,
      loginStatus: users.status,
      loginVersion: users.version,
      transporter: transporters.name,
      createdAt: drivers.createdAt,
      version: drivers.version,
    })
    .from(drivers)
    .leftJoin(users, eq(users.id, drivers.userId))
    .leftJoin(
      driverTransporterAssignments,
      and(
        eq(driverTransporterAssignments.driverId, drivers.id),
        eq(driverTransporterAssignments.organizationId, organizationId),
        isNull(driverTransporterAssignments.validTo)
      )
    )
    .leftJoin(
      transporters,
      eq(transporters.id, driverTransporterAssignments.transporterId)
    )
  const items = await base
    .where(where)
    .orderBy(desc(drivers.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
  const [total] = await db
    .select({ value: count() })
    .from(drivers)
    .where(
      and(
        eq(drivers.organizationId, organizationId),
        query.status === "ALL" ? undefined : eq(drivers.status, query.status),
        search
          ? or(
              ilike(drivers.name, `%${search}%`),
              ilike(drivers.phoneE164, `%${search.replace(/[^0-9+]/g, "")}%`)
            )
          : undefined
      )
    )
  return {
    items,
    total: total.value,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getDriver(actor: SafeAuthContext, id: string) {
  const organizationId = requireAdmin(actor)
  const driver = (
    await getDatabase()
      .select({
        id: drivers.id,
        name: drivers.name,
        phone: drivers.phoneE164,
        status: drivers.status,
        userId: drivers.userId,
        loginStatus: users.status,
        loginVersion: users.version,
        transporterId: transporters.id,
        transporter: transporters.name,
        createdAt: drivers.createdAt,
        updatedAt: drivers.updatedAt,
        version: drivers.version,
      })
      .from(drivers)
      .leftJoin(users, eq(users.id, drivers.userId))
      .leftJoin(
        driverTransporterAssignments,
        and(
          eq(driverTransporterAssignments.driverId, drivers.id),
          eq(driverTransporterAssignments.organizationId, organizationId),
          isNull(driverTransporterAssignments.validTo)
        )
      )
      .leftJoin(
        transporters,
        eq(transporters.id, driverTransporterAssignments.transporterId)
      )
      .where(
        and(eq(drivers.organizationId, organizationId), eq(drivers.id, id))
      )
      .limit(1)
  ).at(0)
  if (!driver) throw new ForbiddenError()
  return driver
}

export async function createDriver(
  actor: SafeAuthContext,
  input: CreateDriverInput
) {
  const organizationId = requireAdmin(actor)
  const prepared = input.loginEnabled
    ? await prepareUserAccount(actor, {
        name: input.loginName,
        phone: input.loginPhone,
        password: input.temporaryPassword,
        role: "DRIVER",
        organizationId,
      })
    : null
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (input.transporterId) {
      const validTransporter = (
        await transaction
          .select({ id: transporters.id })
          .from(transporters)
          .where(
            and(
              eq(transporters.id, input.transporterId),
              eq(transporters.organizationId, organizationId)
            )
          )
          .limit(1)
      ).at(0)
      if (!validTransporter) throw new ForbiddenError()
    }
    const linked = prepared
      ? await insertPreparedUserAccount(transaction, actor, prepared)
      : null
    const [driver] = await transaction
      .insert(drivers)
      .values({
        organizationId,
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        phoneE164: optionalPhone(input.phone),
        userId: linked?.user.id ?? null,
        status: input.status,
        createdByMembershipId: actor.membership.id,
        updatedByMembershipId: actor.membership.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: drivers.id })
    if (input.transporterId) {
      await transaction.insert(driverTransporterAssignments).values({
        organizationId,
        driverId: driver.id,
        transporterId: input.transporterId,
        changedByMembershipId: actor.membership.id,
        validFrom: now,
      })
    }
    await recordMutation(transaction, actor, {
      action: "DRIVER_CREATED",
      message: "Driver created.",
      entityType: "DRIVER",
      entityId: driver.id,
      after: {
        status: input.status,
        loginEnabled: Boolean(linked),
        transporterId: input.transporterId || null,
      },
    })
    return { id: driver.id }
  })
}

export async function setDriverStatus(
  actor: SafeAuthContext,
  input: { id: string; status: "ACTIVE" | "INACTIVE"; version: number }
) {
  const organizationId = requireAdmin(actor)
  await getDatabase().transaction(async (transaction) => {
    const current = (
      await transaction
        .select({ status: drivers.status, version: drivers.version })
        .from(drivers)
        .where(
          and(
            eq(drivers.id, input.id),
            eq(drivers.organizationId, organizationId),
            eq(drivers.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Driver changed; refresh and try again.")
    await transaction
      .update(drivers)
      .set({
        status: input.status,
        version: sql`${drivers.version} + 1`,
        updatedByMembershipId: actor.membership.id,
        updatedAt: new Date(),
      })
      .where(and(eq(drivers.id, input.id), eq(drivers.version, input.version)))
    await recordMutation(transaction, actor, {
      action:
        input.status === "ACTIVE" ? "DRIVER_ACTIVATED" : "DRIVER_DEACTIVATED",
      message: `Driver ${input.status === "ACTIVE" ? "activated" : "deactivated"}.`,
      entityType: "DRIVER",
      entityId: input.id,
      before: current,
      after: { status: input.status, version: current.version + 1 },
    })
  })
}
