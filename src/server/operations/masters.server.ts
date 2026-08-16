import "@tanstack/react-start/server-only"

import { and, asc, eq, inArray } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  companies,
  drivers,
  locations,
  materials,
  memberships,
  transporters,
  users,
  vehicles,
  vendors,
} from "@/server/db/schema"
import { requireOperationsActor } from "./shared.server"

export async function getOperationalMasters(actor: SafeAuthContext) {
  const organizationId = requireOperationsActor(actor)
  const db = getDatabase()
  const [
    vendorRows,
    materialRows,
    locationRows,
    transporterRows,
    driverRows,
    vehicleRows,
    companyRows,
    memberRows,
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
      .select({ id: materials.id, label: materials.name })
      .from(materials)
      .where(
        and(
          eq(materials.organizationId, organizationId),
          eq(materials.status, "ACTIVE")
        )
      )
      .orderBy(asc(materials.name)),
    db
      .select({ id: locations.id, label: locations.name, type: locations.type })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.status, "ACTIVE")
        )
      )
      .orderBy(asc(locations.name)),
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
      .select({ id: drivers.id, label: drivers.name, phone: drivers.phoneE164 })
      .from(drivers)
      .where(
        and(
          eq(drivers.organizationId, organizationId),
          eq(drivers.status, "ACTIVE")
        )
      )
      .orderBy(asc(drivers.name)),
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
      .select({ id: memberships.id, label: users.name, role: memberships.role })
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
  ])
  return {
    vendors: vendorRows,
    materials: materialRows,
    locations: locationRows,
    transporters: transporterRows,
    drivers: driverRows,
    vehicles: vehicleRows,
    companies: companyRows,
    members: memberRows,
  }
}
