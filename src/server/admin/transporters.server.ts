import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { transporters } from "@/server/db/schema"

import {
  normalizeName,
  optionalPhone,
  optionalText,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface TransporterInput {
  id?: string
  name: string
  contactPerson: string
  phone: string
  location: string
  notes: string
  status: "ACTIVE" | "INACTIVE"
  version?: number
}

export async function listTransporters(actor: SafeAuthContext, search = "") {
  const organizationId = requireAdmin(actor)
  return getDatabase()
    .select({
      id: transporters.id,
      name: transporters.name,
      contactPerson: transporters.contactPerson,
      phone: transporters.phoneE164,
      location: transporters.location,
      notes: transporters.notes,
      status: transporters.status,
      version: transporters.version,
    })
    .from(transporters)
    .where(
      and(
        eq(transporters.organizationId, organizationId),
        search ? ilike(transporters.name, `%${search.trim()}%`) : undefined
      )
    )
    .orderBy(desc(transporters.createdAt))
    .limit(50)
}

export async function saveTransporter(
  actor: SafeAuthContext,
  input: TransporterInput
) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (!input.id) {
      const [created] = await transaction
        .insert(transporters)
        .values({
          organizationId,
          name: input.name.trim(),
          normalizedName: normalizeName(input.name),
          contactPerson: optionalText(input.contactPerson),
          phoneE164: optionalPhone(input.phone),
          location: optionalText(input.location),
          notes: optionalText(input.notes),
          status: input.status,
          createdByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: transporters.id })
      await recordMutation(transaction, actor, {
        action: "TRANSPORTER_CREATED",
        message: "Transporter created.",
        entityType: "TRANSPORTER",
        entityId: created.id,
        after: { name: input.name.trim(), status: input.status },
      })
      return created
    }
    if (!input.version) throw new Error("Version is required for updates.")
    const current = (
      await transaction
        .select({
          name: transporters.name,
          status: transporters.status,
          version: transporters.version,
        })
        .from(transporters)
        .where(
          and(
            eq(transporters.id, input.id),
            eq(transporters.organizationId, organizationId),
            eq(transporters.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Transporter changed; refresh and try again.")
    await transaction
      .update(transporters)
      .set({
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        contactPerson: optionalText(input.contactPerson),
        phoneE164: optionalPhone(input.phone),
        location: optionalText(input.location),
        notes: optionalText(input.notes),
        status: input.status,
        updatedByMembershipId: actor.membership.id,
        updatedAt: now,
        version: sql`${transporters.version} + 1`,
      })
      .where(
        and(
          eq(transporters.id, input.id),
          eq(transporters.version, input.version)
        )
      )
    await recordMutation(transaction, actor, {
      action: "TRANSPORTER_UPDATED",
      message: "Transporter updated.",
      entityType: "TRANSPORTER",
      entityId: input.id,
      before: current,
      after: {
        name: input.name.trim(),
        status: input.status,
        version: current.version + 1,
      },
    })
    return { id: input.id }
  })
}
