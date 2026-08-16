import "@tanstack/react-start/server-only"

import { and, count, eq } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  companies,
  drivers,
  memberships,
  transporters,
  users,
  vehicles,
  vendors,
} from "@/server/db/schema"

import { requireAdmin } from "./shared.server"

export async function getAdminDashboard(actor: SafeAuthContext) {
  const organizationId = requireAdmin(actor)
  const db = getDatabase()
  const [
    [members],
    [vendorCount],
    [driverCount],
    [transporterCount],
    [vehicleCount],
    [companyCount],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.role, "MEMBER"),
          eq(users.status, "ACTIVE")
        )
      ),
    db
      .select({ value: count() })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(drivers)
      .where(eq(drivers.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(transporters)
      .where(eq(transporters.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(vehicles)
      .where(eq(vehicles.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(companies)
      .where(eq(companies.organizationId, organizationId)),
  ])
  return {
    members: members.value,
    vendors: vendorCount.value,
    drivers: driverCount.value,
    transporters: transporterCount.value,
    vehicles: vehicleCount.value,
    companies: companyCount.value,
  }
}
