import "@tanstack/react-start/server-only"

import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import type { z } from "zod"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  companies,
  deals,
  drivers,
  tripSettlements,
  trips,
  users,
  vehicles,
  vendors,
  memberships,
} from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"
import type { archiveListSchema } from "./schemas"

type ArchiveInput = z.infer<typeof archiveListSchema>

function archiveWhere(organizationId: string, input: ArchiveInput) {
  const from = input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined
  const to = input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined
  const search = input.search.trim()
  return and(
    eq(trips.organizationId, organizationId),
    eq(trips.status, "ARCHIVED"),
    input.vendorId ? eq(deals.vendorId, input.vendorId) : undefined,
    input.companyId
      ? eq(trips.destinationCompanyId, input.companyId)
      : undefined,
    input.vehicleId ? eq(trips.currentVehicleId, input.vehicleId) : undefined,
    input.ownerMembershipId
      ? eq(trips.ownerMembershipId, input.ownerMembershipId)
      : undefined,
    from ? gte(trips.archivedAt, from) : undefined,
    to ? lte(trips.archivedAt, to) : undefined,
    search
      ? or(
          ilike(trips.tripNumber, `%${search}%`),
          ilike(vehicles.registrationNumber, `%${search}%`),
          ilike(vendors.name, `%${search}%`),
          ilike(drivers.name, `%${search}%`),
          ilike(companies.name, `%${search}%`),
          ilike(trips.challanNumber, `%${search}%`),
          ilike(trips.weighmentCardNumber, `%${search}%`),
          sql`exists (select 1 from bill_lines bl join bills b on b.id = bl.bill_id where bl.trip_id = ${trips.id} and b.bill_number ilike ${`%${search}%`})`,
          sql`exists (select 1 from payment_allocations pa join payments p on p.id = pa.payment_id where pa.trip_id = ${trips.id} and p.receipt_number ilike ${`%${search}%`})`
        )
      : undefined
  )
}

export async function listArchive(actor: SafeAuthContext, input: ArchiveInput) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const where = archiveWhere(organizationId, input)
  const base = db
    .select({
      id: trips.id,
      tripNumber: trips.tripNumber,
      vehicle: vehicles.registrationNumber,
      vendor: vendors.name,
      driver: drivers.name,
      company: companies.name,
      finalWeightMt: trips.finalWeightMt,
      materialValue: tripSettlements.purchaseAmount,
      billedAmount: tripSettlements.billedAmount,
      settlementDate: tripSettlements.postedAt,
      archivedAt: trips.archivedAt,
      owner: users.name,
    })
    .from(trips)
    .innerJoin(deals, eq(deals.id, trips.dealId))
    .innerJoin(vendors, eq(vendors.id, deals.vendorId))
    .innerJoin(companies, eq(companies.id, trips.destinationCompanyId))
    .leftJoin(vehicles, eq(vehicles.id, trips.currentVehicleId))
    .leftJoin(drivers, eq(drivers.id, trips.currentDriverId))
    .innerJoin(memberships, eq(memberships.id, trips.ownerMembershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(
      tripSettlements,
      and(
        eq(tripSettlements.tripId, trips.id),
        sql`${tripSettlements.reversedAt} IS NULL`
      )
    )
    .where(where)
  const [items, [total]] = await Promise.all([
    base
      .orderBy(desc(trips.archivedAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ value: count() })
      .from(trips)
      .innerJoin(deals, eq(deals.id, trips.dealId))
      .innerJoin(vendors, eq(vendors.id, deals.vendorId))
      .innerJoin(companies, eq(companies.id, trips.destinationCompanyId))
      .leftJoin(vehicles, eq(vehicles.id, trips.currentVehicleId))
      .leftJoin(drivers, eq(drivers.id, trips.currentDriverId))
      .innerJoin(memberships, eq(memberships.id, trips.ownerMembershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(
        tripSettlements,
        and(
          eq(tripSettlements.tripId, trips.id),
          sql`${tripSettlements.reversedAt} IS NULL`
        )
      )
      .where(where),
  ])
  return {
    items,
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}
