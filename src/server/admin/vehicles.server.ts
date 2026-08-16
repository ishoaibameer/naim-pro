import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm"

import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  transporters,
  vehicles,
  vehicleTransporterAssignments,
} from "@/server/db/schema"

import {
  normalizeRegistration,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface VehicleInput {
  id?: string
  registrationNumber: string
  transporterId: string
  status: "ACTIVE" | "INACTIVE"
  version?: number
}

export async function listVehicles(actor: SafeAuthContext, search = "") {
  const organizationId = requireAdmin(actor)
  const normalizedSearch = normalizeRegistration(search)
  return getDatabase()
    .select({
      id: vehicles.id,
      registrationNumber: vehicles.registrationNumber,
      normalizedRegistrationNumber: vehicles.normalizedRegistrationNumber,
      transporterId: transporters.id,
      transporter: transporters.name,
      status: vehicles.status,
      version: vehicles.version,
    })
    .from(vehicles)
    .leftJoin(
      vehicleTransporterAssignments,
      and(
        eq(vehicleTransporterAssignments.vehicleId, vehicles.id),
        eq(vehicleTransporterAssignments.organizationId, organizationId),
        isNull(vehicleTransporterAssignments.validTo)
      )
    )
    .leftJoin(
      transporters,
      eq(transporters.id, vehicleTransporterAssignments.transporterId)
    )
    .where(
      and(
        eq(vehicles.organizationId, organizationId),
        normalizedSearch
          ? ilike(
              vehicles.normalizedRegistrationNumber,
              `%${normalizedSearch}%`
            )
          : undefined
      )
    )
    .orderBy(desc(vehicles.createdAt))
    .limit(50)
}

export async function saveVehicle(actor: SafeAuthContext, input: VehicleInput) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (input.transporterId) {
      const owner = (
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
      if (!owner) throw new ForbiddenError()
    }

    if (!input.id) {
      const [created] = await transaction
        .insert(vehicles)
        .values({
          organizationId,
          registrationNumber: input.registrationNumber.trim().toUpperCase(),
          normalizedRegistrationNumber: normalizeRegistration(
            input.registrationNumber
          ),
          status: input.status,
          createdByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: vehicles.id })
      if (input.transporterId) {
        await transaction.insert(vehicleTransporterAssignments).values({
          organizationId,
          vehicleId: created.id,
          transporterId: input.transporterId,
          changedByMembershipId: actor.membership.id,
          validFrom: now,
        })
      }
      await recordMutation(transaction, actor, {
        action: "VEHICLE_CREATED",
        message: "Vehicle created.",
        entityType: "VEHICLE",
        entityId: created.id,
        after: {
          registrationNumber: input.registrationNumber.trim().toUpperCase(),
          transporterId: input.transporterId || null,
        },
      })
      return created
    }

    if (!input.version) throw new Error("Version is required for updates.")
    const current = (
      await transaction
        .select({
          registrationNumber: vehicles.registrationNumber,
          status: vehicles.status,
          version: vehicles.version,
          transporterId: vehicleTransporterAssignments.transporterId,
        })
        .from(vehicles)
        .leftJoin(
          vehicleTransporterAssignments,
          and(
            eq(vehicleTransporterAssignments.vehicleId, vehicles.id),
            isNull(vehicleTransporterAssignments.validTo)
          )
        )
        .where(
          and(
            eq(vehicles.id, input.id),
            eq(vehicles.organizationId, organizationId),
            eq(vehicles.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Vehicle changed; refresh and try again.")

    await transaction
      .update(vehicles)
      .set({
        registrationNumber: input.registrationNumber.trim().toUpperCase(),
        normalizedRegistrationNumber: normalizeRegistration(
          input.registrationNumber
        ),
        status: input.status,
        updatedByMembershipId: actor.membership.id,
        updatedAt: now,
        version: sql`${vehicles.version} + 1`,
      })
      .where(
        and(eq(vehicles.id, input.id), eq(vehicles.version, input.version))
      )
    if ((current.transporterId ?? "") !== input.transporterId) {
      await transaction
        .update(vehicleTransporterAssignments)
        .set({ validTo: now })
        .where(
          and(
            eq(vehicleTransporterAssignments.organizationId, organizationId),
            eq(vehicleTransporterAssignments.vehicleId, input.id),
            isNull(vehicleTransporterAssignments.validTo)
          )
        )
      if (input.transporterId) {
        await transaction.insert(vehicleTransporterAssignments).values({
          organizationId,
          vehicleId: input.id,
          transporterId: input.transporterId,
          changedByMembershipId: actor.membership.id,
          validFrom: now,
        })
      }
    }
    await recordMutation(transaction, actor, {
      action: "VEHICLE_UPDATED",
      message: "Vehicle updated.",
      entityType: "VEHICLE",
      entityId: input.id,
      before: current,
      after: {
        registrationNumber: input.registrationNumber.trim().toUpperCase(),
        status: input.status,
        transporterId: input.transporterId || null,
        version: current.version + 1,
      },
    })
    return { id: input.id }
  })
}
