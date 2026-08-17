import "@tanstack/react-start/server-only"

import { and, asc, eq, inArray, ne } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  companies,
  deals,
  memberships,
  transporters,
  trips,
  users,
  vendors,
  vehicles,
} from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"

export async function getFinanceMasters(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [
    vendorRows,
    transporterRows,
    companyRows,
    dealRows,
    tripRows,
    billRows,
    memberRows,
    vehicleRows,
  ] = await Promise.all([
    db
      .select({ id: vendors.id, label: vendors.name })
      .from(vendors)
      .where(
        and(
          eq(vendors.organizationId, organizationId),
          eq(vendors.status, "ACTIVE")
        )
      )
      .orderBy(asc(vendors.name)),
    db
      .select({ id: transporters.id, label: transporters.name })
      .from(transporters)
      .where(
        and(
          eq(transporters.organizationId, organizationId),
          eq(transporters.status, "ACTIVE")
        )
      )
      .orderBy(asc(transporters.name)),
    db
      .select({ id: companies.id, label: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, organizationId),
          eq(companies.status, "ACTIVE")
        )
      )
      .orderBy(asc(companies.name)),
    db
      .select({
        id: deals.id,
        label: deals.dealNumber,
        vendorId: deals.vendorId,
      })
      .from(deals)
      .where(
        and(
          eq(deals.organizationId, organizationId),
          inArray(deals.status, ["ACTIVE", "FULFILLED"])
        )
      )
      .orderBy(asc(deals.dealNumber)),
    db
      .select({
        id: trips.id,
        label: trips.tripNumber,
        dealId: trips.dealId,
        transporterId: trips.currentTransporterId,
        companyId: trips.destinationCompanyId,
        vehicleId: trips.currentVehicleId,
        status: trips.status,
      })
      .from(trips)
      .where(
        and(
          eq(trips.organizationId, organizationId),
          ne(trips.status, "CANCELLED")
        )
      )
      .orderBy(asc(trips.tripNumber)),
    db
      .select({
        id: bills.id,
        label: bills.billNumber,
        companyId: bills.companyId,
        status: bills.status,
      })
      .from(bills)
      .where(
        and(eq(bills.organizationId, organizationId), ne(bills.status, "VOID"))
      )
      .orderBy(asc(bills.billNumber)),
    db
      .select({ id: memberships.id, label: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.status, "ACTIVE"),
          eq(users.status, "ACTIVE"),
          inArray(memberships.role, ["ADMIN", "MEMBER"])
        )
      )
      .orderBy(asc(users.name)),
    db
      .select({ id: vehicles.id, label: vehicles.registrationNumber })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.organizationId, organizationId),
          eq(vehicles.status, "ACTIVE")
        )
      )
      .orderBy(asc(vehicles.registrationNumber)),
  ])
  return {
    vendors: vendorRows,
    transporters: transporterRows,
    companies: companyRows,
    deals: dealRows,
    trips: tripRows,
    bills: billRows,
    members: memberRows,
    vehicles: vehicleRows,
  }
}
