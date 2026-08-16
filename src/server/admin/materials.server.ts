import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { materials } from "@/server/db/schema"

import {
  normalizeName,
  optionalText,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface MaterialInput {
  id?: string
  name: string
  description: string
  status: "ACTIVE" | "INACTIVE"
  version?: number
}

export async function listMaterials(actor: SafeAuthContext, search = "") {
  const organizationId = requireAdmin(actor)
  return getDatabase()
    .select({
      id: materials.id,
      name: materials.name,
      description: materials.description,
      status: materials.status,
      version: materials.version,
    })
    .from(materials)
    .where(
      and(
        eq(materials.organizationId, organizationId),
        search ? ilike(materials.name, `%${search.trim()}%`) : undefined
      )
    )
    .orderBy(desc(materials.createdAt))
    .limit(50)
}

export async function saveMaterial(
  actor: SafeAuthContext,
  input: MaterialInput
) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (!input.id) {
      const [created] = await transaction
        .insert(materials)
        .values({
          organizationId,
          name: input.name.trim(),
          normalizedName: normalizeName(input.name),
          description: optionalText(input.description),
          status: input.status,
          createdByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: materials.id })
      await recordMutation(transaction, actor, {
        action: "MATERIAL_CREATED",
        message: "Material created.",
        entityType: "MATERIAL",
        entityId: created.id,
        after: { name: input.name.trim(), status: input.status },
      })
      return created
    }
    if (!input.version) throw new Error("Version is required for updates.")
    const current = (
      await transaction
        .select({
          name: materials.name,
          status: materials.status,
          version: materials.version,
        })
        .from(materials)
        .where(
          and(
            eq(materials.id, input.id),
            eq(materials.organizationId, organizationId),
            eq(materials.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Material changed; refresh and try again.")
    await transaction
      .update(materials)
      .set({
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        description: optionalText(input.description),
        status: input.status,
        updatedByMembershipId: actor.membership.id,
        updatedAt: now,
        version: sql`${materials.version} + 1`,
      })
      .where(
        and(eq(materials.id, input.id), eq(materials.version, input.version))
      )
    await recordMutation(transaction, actor, {
      action: "MATERIAL_UPDATED",
      message: "Material updated.",
      entityType: "MATERIAL",
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
