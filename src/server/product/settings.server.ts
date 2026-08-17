import "@tanstack/react-start/server-only"

import { and, eq } from "drizzle-orm"

import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { organizations } from "@/server/db/schema"
import { recordMutation, requireAdmin } from "@/server/admin/shared.server"
import type { OrganizationSettingsInput } from "./schemas"

export async function getOrganizationSettings(actor: SafeAuthContext) {
  const organizationId = requireAdmin(actor)
  const settings = (
    await getDatabase()
      .select({
        id: organizations.id,
        name: organizations.name,
        weightWarningThresholdPct: organizations.weightWarningThresholdPct,
        expectedTransitDurationHours:
          organizations.expectedTransitDurationHours,
        defaultPageSize: organizations.defaultPageSize,
        version: organizations.version,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
  ).at(0)
  if (!settings) throw new ForbiddenError()
  return settings
}

export async function saveOrganizationSettings(
  actor: SafeAuthContext,
  input: OrganizationSettingsInput
) {
  const organizationId = requireAdmin(actor)
  return getDatabase().transaction(async (tx) => {
    const before = (
      await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
        .for("update")
    ).at(0)
    if (!before) throw new ForbiddenError()
    if (before.version !== input.version)
      throw new Error("Settings changed. Refresh and try again.")
    const updated = (
      await tx
        .update(organizations)
        .set({
          name: input.name,
          weightWarningThresholdPct: input.weightWarningThresholdPct,
          expectedTransitDurationHours: input.expectedTransitDurationHours,
          defaultPageSize: input.defaultPageSize,
          updatedAt: new Date(),
          version: before.version + 1,
        })
        .where(
          and(
            eq(organizations.id, organizationId),
            eq(organizations.version, before.version)
          )
        )
        .returning()
    ).at(0)
    if (!updated) throw new Error("Settings changed. Refresh and try again.")
    await recordMutation(tx, actor, {
      action: "ORGANIZATION_SETTINGS_UPDATED",
      message: `${actor.user.name} updated organization settings`,
      entityType: "ORGANIZATION",
      entityId: organizationId,
      before: {
        name: before.name,
        weightWarningThresholdPct: before.weightWarningThresholdPct,
        expectedTransitDurationHours: before.expectedTransitDurationHours,
        defaultPageSize: before.defaultPageSize,
        version: before.version,
      },
      after: {
        name: updated.name,
        weightWarningThresholdPct: updated.weightWarningThresholdPct,
        expectedTransitDurationHours: updated.expectedTransitDurationHours,
        defaultPageSize: updated.defaultPageSize,
        version: updated.version,
      },
    })
    return updated
  })
}

export async function getOperationalSettings(organizationId: string) {
  const settings = (
    await getDatabase()
      .select({
        weightWarningThresholdPct: organizations.weightWarningThresholdPct,
        expectedTransitDurationHours:
          organizations.expectedTransitDurationHours,
        defaultPageSize: organizations.defaultPageSize,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
  ).at(0)
  if (!settings) throw new ForbiddenError()
  return settings
}
