import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { z } from "zod"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  activityEvents,
  dealStatusEvents,
  deals,
  locations,
  materials,
  memberships,
  trips,
  users,
  vendors,
} from "@/server/db/schema"
import type { createDealSchema, dealListSchema } from "./schemas"
import {
  recordOperationalMutation,
  requireOperationsActor,
} from "./shared.server"

type DealListInput = z.infer<typeof dealListSchema>
type CreateDealInput = z.infer<typeof createDealSchema>

const ownerUsers = alias(users, "deal_owner_users")
const creatorUsers = alias(users, "deal_creator_users")
const creatorMemberships = alias(memberships, "deal_creator_memberships")

function dateBounds(input: DealListInput) {
  return {
    from: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
    to: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
  }
}

export async function listDeals(actor: SafeAuthContext, input: DealListInput) {
  const organizationId = requireOperationsActor(actor)
  const search = input.search.trim()
  const { from, to } = dateBounds(input)
  const where = and(
    eq(deals.organizationId, organizationId),
    input.status === "ALL" ? undefined : eq(deals.status, input.status),
    input.vendorId ? eq(deals.vendorId, input.vendorId) : undefined,
    input.ownerMembershipId
      ? eq(deals.ownerMembershipId, input.ownerMembershipId)
      : undefined,
    input.materialId ? eq(deals.materialId, input.materialId) : undefined,
    from ? gte(deals.createdAt, from) : undefined,
    to ? lte(deals.createdAt, to) : undefined,
    search
      ? or(
          ilike(deals.dealNumber, `%${search}%`),
          ilike(vendors.name, `%${search}%`),
          ilike(locations.name, `%${search}%`),
          ilike(materials.name, `%${search}%`),
          ilike(ownerUsers.name, `%${search}%`)
        )
      : undefined
  )
  const db = getDatabase()
  const base = db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      vendor: vendors.name,
      pickup: locations.name,
      material: materials.name,
      purchaseRate: deals.purchaseRate,
      expectedQuantityMt: deals.expectedQuantityMt,
      owner: ownerUsers.name,
      status: deals.status,
      createdAt: deals.createdAt,
      version: deals.version,
      tripsCount: sql<number>`count(${trips.id})::int`,
    })
    .from(deals)
    .innerJoin(
      vendors,
      and(
        eq(vendors.organizationId, deals.organizationId),
        eq(vendors.id, deals.vendorId)
      )
    )
    .innerJoin(
      locations,
      and(
        eq(locations.organizationId, deals.organizationId),
        eq(locations.id, deals.pickupLocationId)
      )
    )
    .innerJoin(
      materials,
      and(
        eq(materials.organizationId, deals.organizationId),
        eq(materials.id, deals.materialId)
      )
    )
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, deals.organizationId),
        eq(memberships.id, deals.ownerMembershipId)
      )
    )
    .innerJoin(ownerUsers, eq(ownerUsers.id, memberships.userId))
    .leftJoin(
      trips,
      and(
        eq(trips.organizationId, deals.organizationId),
        eq(trips.dealId, deals.id)
      )
    )
    .where(where)
    .groupBy(
      deals.id,
      vendors.name,
      locations.name,
      materials.name,
      ownerUsers.name
    )
    .orderBy(desc(deals.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
  const [items, [total]] = await Promise.all([
    base,
    db
      .select({ value: count() })
      .from(deals)
      .innerJoin(
        vendors,
        and(
          eq(vendors.organizationId, deals.organizationId),
          eq(vendors.id, deals.vendorId)
        )
      )
      .innerJoin(
        locations,
        and(
          eq(locations.organizationId, deals.organizationId),
          eq(locations.id, deals.pickupLocationId)
        )
      )
      .innerJoin(
        materials,
        and(
          eq(materials.organizationId, deals.organizationId),
          eq(materials.id, deals.materialId)
        )
      )
      .innerJoin(
        memberships,
        and(
          eq(memberships.organizationId, deals.organizationId),
          eq(memberships.id, deals.ownerMembershipId)
        )
      )
      .innerJoin(ownerUsers, eq(ownerUsers.id, memberships.userId))
      .where(where),
  ])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

async function requireActiveEntity(
  tx: Parameters<
    Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
  >[0],
  table: typeof vendors | typeof materials | typeof locations,
  id: string,
  organizationId: string,
  label: string
) {
  const record = (
    await tx
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.organizationId, organizationId),
          eq(table.status, "ACTIVE")
        )
      )
      .limit(1)
  ).at(0)
  if (!record) throw new Error(`${label} is not active in this organization.`)
}

export async function createDeal(
  actor: SafeAuthContext,
  input: CreateDealInput
) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const id = randomUUID()
  const dealNumber = `DL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`
  return db.transaction(async (tx) => {
    await requireActiveEntity(
      tx,
      vendors,
      input.vendorId,
      organizationId,
      "Vendor"
    )
    await requireActiveEntity(
      tx,
      materials,
      input.materialId,
      organizationId,
      "Material"
    )
    await requireActiveEntity(
      tx,
      locations,
      input.pickupLocationId,
      organizationId,
      "Pickup location"
    )
    const owner = (
      await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.id, input.ownerMembershipId),
            eq(memberships.organizationId, organizationId),
            eq(memberships.status, "ACTIVE"),
            eq(users.status, "ACTIVE"),
            or(eq(memberships.role, "MEMBER"), eq(memberships.role, "ADMIN"))
          )
        )
        .limit(1)
    ).at(0)
    if (!owner)
      throw new Error("Owner is not an active member of this organization.")
    const [record] = await tx
      .insert(deals)
      .values({
        id,
        organizationId,
        dealNumber,
        vendorId: input.vendorId,
        materialId: input.materialId,
        pickupLocationId: input.pickupLocationId,
        purchaseRate: input.purchaseRate,
        expectedQuantityMt: input.expectedQuantityMt,
        ownerMembershipId: input.ownerMembershipId,
        status: "ACTIVE",
        notes: input.notes,
        createdByMembershipId: actor.membership.id,
        updatedByMembershipId: actor.membership.id,
      })
      .returning()
    await tx.insert(dealStatusEvents).values({
      organizationId,
      dealId: id,
      fromStatus: null,
      toStatus: "ACTIVE",
      changedByMembershipId: actor.membership.id,
    })
    await recordOperationalMutation(tx, actor, {
      action: "DEAL_CREATED",
      message: `${actor.user.name} created Deal ${dealNumber}`,
      entityType: "DEAL",
      entityId: id,
      after: { dealNumber, status: "ACTIVE", ...input },
    })
    return record
  })
}

export async function getDeal(actor: SafeAuthContext, id: string) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const record = (
    await db
      .select({
        id: deals.id,
        dealNumber: deals.dealNumber,
        vendor: vendors.name,
        pickup: locations.name,
        material: materials.name,
        purchaseRate: deals.purchaseRate,
        expectedQuantityMt: deals.expectedQuantityMt,
        owner: ownerUsers.name,
        createdBy: creatorUsers.name,
        notes: deals.notes,
        status: deals.status,
        createdAt: deals.createdAt,
        version: deals.version,
      })
      .from(deals)
      .innerJoin(
        vendors,
        and(
          eq(vendors.organizationId, deals.organizationId),
          eq(vendors.id, deals.vendorId)
        )
      )
      .innerJoin(
        locations,
        and(
          eq(locations.organizationId, deals.organizationId),
          eq(locations.id, deals.pickupLocationId)
        )
      )
      .innerJoin(
        materials,
        and(
          eq(materials.organizationId, deals.organizationId),
          eq(materials.id, deals.materialId)
        )
      )
      .innerJoin(
        memberships,
        and(
          eq(memberships.organizationId, deals.organizationId),
          eq(memberships.id, deals.ownerMembershipId)
        )
      )
      .innerJoin(ownerUsers, eq(ownerUsers.id, memberships.userId))
      .innerJoin(
        creatorMemberships,
        and(
          eq(creatorMemberships.organizationId, deals.organizationId),
          eq(creatorMemberships.id, deals.createdByMembershipId)
        )
      )
      .innerJoin(creatorUsers, eq(creatorUsers.id, creatorMemberships.userId))
      .where(and(eq(deals.organizationId, organizationId), eq(deals.id, id)))
      .limit(1)
  ).at(0)
  if (!record) throw new Error("Deal not found.")
  const dealTrips = await db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      status: trips.status,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(and(eq(trips.organizationId, organizationId), eq(trips.dealId, id)))
    .orderBy(desc(trips.createdAt))
    .limit(50)
  const events = await db
    .select({
      id: activityEvents.id,
      message: activityEvents.message,
      eventType: activityEvents.eventType,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        eq(activityEvents.entityType, "DEAL"),
        eq(activityEvents.entityId, id)
      )
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(50)
  return { ...record, trips: dealTrips, events }
}
