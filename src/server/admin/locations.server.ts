import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { locations } from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"

import {
  lockMasterName,
  normalizeName,
  optionalText,
  recordMutation,
  requireAdmin,
} from "./shared.server"
import type { DatabaseTransaction } from "./shared.server"

export interface LocationInput {
  id?: string
  name: string
  type: "PICKUP" | "DESTINATION" | "OTHER" | null
  address: string
  status: "ACTIVE" | "INACTIVE"
  version?: number
}

export interface CreateInlineLocationInput {
  name: string
  type: "PICKUP" | "DESTINATION" | "OTHER"
  address: string
}

async function insertLocationRecord(
  transaction: DatabaseTransaction,
  actor: SafeAuthContext,
  input: Pick<LocationInput, "name" | "type" | "address" | "status">,
  now: Date
) {
  const [created] = await transaction
    .insert(locations)
    .values({
      organizationId: actor.membership.organizationId,
      name: input.name.trim(),
      normalizedName: normalizeName(input.name),
      type: input.type,
      address: optionalText(input.address),
      status: input.status,
      createdByMembershipId: actor.membership.id,
      updatedByMembershipId: actor.membership.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: locations.id })
  await recordMutation(transaction, actor, {
    action: "LOCATION_CREATED",
    message: "Location created.",
    entityType: "LOCATION",
    entityId: created.id,
    after: {
      name: input.name.trim(),
      type: input.type,
      status: input.status,
    },
  })
  return created
}

export async function listLocations(actor: SafeAuthContext, search = "") {
  const organizationId = requireAdmin(actor)
  return getDatabase()
    .select({
      id: locations.id,
      name: locations.name,
      type: locations.type,
      address: locations.address,
      status: locations.status,
      version: locations.version,
    })
    .from(locations)
    .where(
      and(
        eq(locations.organizationId, organizationId),
        search ? ilike(locations.name, `%${search.trim()}%`) : undefined
      )
    )
    .orderBy(desc(locations.createdAt))
    .limit(50)
}

export async function saveLocation(
  actor: SafeAuthContext,
  input: LocationInput
) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (!input.id) {
      return insertLocationRecord(transaction, actor, input, now)
    }
    if (!input.version) throw new Error("Version is required for updates.")
    const current = (
      await transaction
        .select({
          name: locations.name,
          type: locations.type,
          status: locations.status,
          version: locations.version,
        })
        .from(locations)
        .where(
          and(
            eq(locations.id, input.id),
            eq(locations.organizationId, organizationId),
            eq(locations.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Location changed; refresh and try again.")
    await transaction
      .update(locations)
      .set({
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        type: input.type,
        address: optionalText(input.address),
        status: input.status,
        updatedByMembershipId: actor.membership.id,
        updatedAt: now,
        version: sql`${locations.version} + 1`,
      })
      .where(
        and(eq(locations.id, input.id), eq(locations.version, input.version))
      )
    await recordMutation(transaction, actor, {
      action: "LOCATION_UPDATED",
      message: "Location updated.",
      entityType: "LOCATION",
      entityId: input.id,
      before: current,
      after: {
        name: input.name.trim(),
        type: input.type,
        status: input.status,
        version: current.version + 1,
      },
    })
    return { id: input.id }
  })
}

export async function createInlineLocation(
  actor: SafeAuthContext,
  input: CreateInlineLocationInput
) {
  const organizationId = requireOperationsActor(actor)
  const normalizedName = normalizeName(input.name)
  return getDatabase().transaction(async (transaction) => {
    await lockMasterName(
      transaction,
      organizationId,
      "LOCATION",
      normalizedName
    )
    const existing = (
      await transaction
        .select({
          id: locations.id,
          name: locations.name,
          status: locations.status,
        })
        .from(locations)
        .where(
          and(
            eq(locations.organizationId, organizationId),
            eq(locations.normalizedName, normalizedName),
            eq(locations.type, input.type)
          )
        )
        .limit(1)
    ).at(0)
    if (existing) {
      if (existing.status !== "ACTIVE")
        throw new Error(
          "Location already exists but is inactive. Ask an administrator to activate it."
        )
      return {
        id: existing.id,
        label: existing.name,
        created: false,
        locationType: input.type,
      }
    }
    const created = await insertLocationRecord(
      transaction,
      actor,
      { ...input, status: "ACTIVE" },
      new Date()
    )
    return {
      id: created.id,
      label: input.name.trim(),
      created: true,
      locationType: input.type,
    }
  })
}
