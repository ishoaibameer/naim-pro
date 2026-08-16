import "@tanstack/react-start/server-only"

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"

import {
  insertPreparedUserAccount,
  prepareUserAccount,
} from "@/server/auth/admin.server"
import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { users, vendors } from "@/server/db/schema"

import type { ListQuery } from "./schemas"
import {
  normalizeName,
  optionalPhone,
  optionalText,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface CreateVendorInput {
  name: string
  contactPerson: string
  phone: string
  location: string
  notes: string
  status: "ACTIVE" | "INACTIVE"
  loginEnabled: boolean
  loginName: string
  loginPhone: string
  temporaryPassword: string
}

export async function listVendors(actor: SafeAuthContext, query: ListQuery) {
  const organizationId = requireAdmin(actor)
  const db = getDatabase()
  const search = query.search.trim()
  const conditions = [
    eq(vendors.organizationId, organizationId),
    query.status === "ALL" ? undefined : eq(vendors.status, query.status),
    search
      ? or(
          ilike(vendors.name, `%${search}%`),
          ilike(vendors.phoneE164, `%${search.replace(/[^0-9+]/g, "")}%`),
          ilike(vendors.location, `%${search}%`)
        )
      : undefined,
  ].filter((condition) => condition !== undefined)
  const where = and(...conditions)
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: vendors.id,
        name: vendors.name,
        contactPerson: vendors.contactPerson,
        phone: vendors.phoneE164,
        location: vendors.location,
        status: vendors.status,
        userId: vendors.userId,
        loginStatus: users.status,
        loginVersion: users.version,
        createdAt: vendors.createdAt,
        version: vendors.version,
      })
      .from(vendors)
      .leftJoin(users, eq(users.id, vendors.userId))
      .where(where)
      .orderBy(desc(vendors.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(vendors).where(where),
  ])
  return {
    items,
    total: total.value,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getVendor(actor: SafeAuthContext, id: string) {
  const organizationId = requireAdmin(actor)
  const vendor = (
    await getDatabase()
      .select({
        id: vendors.id,
        name: vendors.name,
        contactPerson: vendors.contactPerson,
        phone: vendors.phoneE164,
        location: vendors.location,
        notes: vendors.notes,
        status: vendors.status,
        userId: vendors.userId,
        loginStatus: users.status,
        loginVersion: users.version,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
        version: vendors.version,
      })
      .from(vendors)
      .leftJoin(users, eq(users.id, vendors.userId))
      .where(
        and(eq(vendors.organizationId, organizationId), eq(vendors.id, id))
      )
      .limit(1)
  ).at(0)
  if (!vendor) throw new ForbiddenError()
  return vendor
}

export async function createVendor(
  actor: SafeAuthContext,
  input: CreateVendorInput
) {
  const organizationId = requireAdmin(actor)
  const prepared = input.loginEnabled
    ? await prepareUserAccount(actor, {
        name: input.loginName,
        phone: input.loginPhone,
        password: input.temporaryPassword,
        role: "VENDOR",
        organizationId,
      })
    : null
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    const linked = prepared
      ? await insertPreparedUserAccount(transaction, actor, prepared)
      : null
    const [vendor] = await transaction
      .insert(vendors)
      .values({
        organizationId,
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        contactPerson: optionalText(input.contactPerson),
        phoneE164: optionalPhone(input.phone),
        location: optionalText(input.location),
        notes: optionalText(input.notes),
        userId: linked?.user.id ?? null,
        status: input.status,
        createdByMembershipId: actor.membership.id,
        updatedByMembershipId: actor.membership.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: vendors.id })
    await recordMutation(transaction, actor, {
      action: "VENDOR_CREATED",
      message: "Vendor created.",
      entityType: "VENDOR",
      entityId: vendor.id,
      after: { status: input.status, loginEnabled: Boolean(linked) },
    })
    return { id: vendor.id }
  })
}

export async function setVendorStatus(
  actor: SafeAuthContext,
  input: { id: string; status: "ACTIVE" | "INACTIVE"; version: number }
) {
  const organizationId = requireAdmin(actor)
  await getDatabase().transaction(async (transaction) => {
    const current = (
      await transaction
        .select({ status: vendors.status, version: vendors.version })
        .from(vendors)
        .where(
          and(
            eq(vendors.id, input.id),
            eq(vendors.organizationId, organizationId),
            eq(vendors.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Vendor changed; refresh and try again.")
    await transaction
      .update(vendors)
      .set({
        status: input.status,
        version: sql`${vendors.version} + 1`,
        updatedByMembershipId: actor.membership.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vendors.id, input.id),
          eq(vendors.organizationId, organizationId),
          eq(vendors.version, input.version)
        )
      )
    await recordMutation(transaction, actor, {
      action:
        input.status === "ACTIVE" ? "VENDOR_ACTIVATED" : "VENDOR_DEACTIVATED",
      message: `Vendor ${input.status === "ACTIVE" ? "activated" : "deactivated"}.`,
      entityType: "VENDOR",
      entityId: input.id,
      before: current,
      after: { status: input.status, version: current.version + 1 },
    })
  })
}
