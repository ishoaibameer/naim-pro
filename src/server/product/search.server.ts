import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, or, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  companies,
  deals,
  drivers,
  payments,
  trips,
  vehicles,
  vendors,
} from "@/server/db/schema"
import { requireOperationsActor } from "@/server/operations/shared.server"

export async function globalSearch(actor: SafeAuthContext, query: string) {
  const organizationId = requireOperationsActor(actor)
  const q = query.trim()
  if (q.length < 2)
    return {
      trips: [],
      deals: [],
      parties: [],
      vehicles: [],
      drivers: [],
      payments: [],
    }
  const pattern = `%${q}%`
  const db = getDatabase()
  const [tripRows, dealRows, partyRows, vehicleRows, driverRows, paymentRows] =
    await Promise.all([
      db
        .select({
          id: trips.id,
          primary: trips.tripNumber,
          secondary: sql<string>`concat_ws(' · ', ${vehicles.registrationNumber}, ${trips.challanNumber}, ${trips.weighmentCardNumber})`,
        })
        .from(trips)
        .leftJoin(
          vehicles,
          and(
            eq(vehicles.organizationId, trips.organizationId),
            eq(vehicles.id, trips.currentVehicleId)
          )
        )
        .where(
          and(
            eq(trips.organizationId, organizationId),
            or(
              ilike(trips.tripNumber, pattern),
              ilike(trips.challanNumber, pattern),
              ilike(trips.weighmentCardNumber, pattern),
              ilike(vehicles.registrationNumber, pattern)
            )
          )
        )
        .orderBy(desc(trips.updatedAt))
        .limit(8),
      db
        .select({
          id: deals.id,
          primary: deals.dealNumber,
          secondary: vendors.name,
        })
        .from(deals)
        .innerJoin(
          vendors,
          and(
            eq(vendors.organizationId, deals.organizationId),
            eq(vendors.id, deals.vendorId)
          )
        )
        .where(
          and(
            eq(deals.organizationId, organizationId),
            or(ilike(deals.dealNumber, pattern), ilike(vendors.name, pattern))
          )
        )
        .orderBy(desc(deals.updatedAt))
        .limit(8),
      db
        .select({
          id: vendors.id,
          primary: vendors.name,
          secondary: sql<string>`'Vendor'`,
          type: sql<"VENDOR" | "COMPANY">`'VENDOR'`,
        })
        .from(vendors)
        .where(
          and(
            eq(vendors.organizationId, organizationId),
            ilike(vendors.name, pattern)
          )
        )
        .limit(5)
        .unionAll(
          db
            .select({
              id: companies.id,
              primary: companies.name,
              secondary: sql<string>`'Company'`,
              type: sql<"VENDOR" | "COMPANY">`'COMPANY'`,
            })
            .from(companies)
            .where(
              and(
                eq(companies.organizationId, organizationId),
                ilike(companies.name, pattern)
              )
            )
            .limit(5)
        ),
      db
        .select({
          id: vehicles.id,
          primary: vehicles.registrationNumber,
          secondary: vehicles.vehicleType,
        })
        .from(vehicles)
        .where(
          and(
            eq(vehicles.organizationId, organizationId),
            ilike(vehicles.registrationNumber, pattern)
          )
        )
        .limit(8),
      db
        .select({
          id: drivers.id,
          primary: drivers.name,
          secondary: drivers.licenseNumber,
        })
        .from(drivers)
        .where(
          and(
            eq(drivers.organizationId, organizationId),
            or(
              ilike(drivers.name, pattern),
              ilike(drivers.licenseNumber, pattern)
            )
          )
        )
        .limit(8),
      db
        .select({
          id: payments.id,
          primary: payments.paymentNumber,
          secondary: sql<string>`concat_ws(' · ', ${payments.receiptNumber}, ${payments.amount})`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            or(
              ilike(payments.paymentNumber, pattern),
              ilike(payments.receiptNumber, pattern)
            )
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(8),
    ])
  return {
    trips: tripRows.map((item) => ({ ...item, href: `/app/trips/${item.id}` })),
    deals: dealRows.map((item) => ({ ...item, href: `/app/deals/${item.id}` })),
    parties: partyRows.map((item) => ({
      ...item,
      href:
        item.type === "VENDOR"
          ? `/app/vendors/${item.id}`
          : `/app/companies/${item.id}`,
    })),
    vehicles: vehicleRows.map((item) => ({
      ...item,
      href: `/app/vehicles/${item.id}`,
    })),
    drivers: driverRows.map((item) => ({ ...item, href: null })),
    payments: paymentRows.map((item) => ({
      ...item,
      href: `/app/payments/${item.id}`,
    })),
  }
}
