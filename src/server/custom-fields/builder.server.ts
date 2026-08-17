import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import { and, asc, count, eq, inArray } from "drizzle-orm"

import { ForbiddenError, requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  customFieldDefinitions,
  customFieldEditableRoles,
  customFieldOptions,
  customFieldValues,
  customFieldVersions,
  customFieldVisibleRoles,
} from "@/server/db/schema"
import { recordOperationalMutation } from "@/server/operations/shared.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import {
  PROTECTED_CORE_FIELDS,
  TARGET_SECTIONS,
  slugifyFieldKey,
} from "./config"
import type { CustomFieldRole, CustomFieldTarget } from "./config"
import type { SaveCustomFieldDefinitionInput } from "./schemas"

type DefinitionRow = Awaited<ReturnType<typeof currentDefinitionRows>>[number]

function requireBuilderAdmin(actor: SafeAuthContext): string {
  requireRole(actor, ["ADMIN"])
  return actor.membership.organizationId
}

export async function currentDefinitionRows(
  organizationId: string,
  target: CustomFieldTarget,
  transaction:
    ReturnType<typeof getDatabase> | OperationsTransaction = getDatabase()
) {
  return transaction
    .select({
      id: customFieldDefinitions.id,
      target: customFieldDefinitions.target,
      key: customFieldDefinitions.key,
      status: customFieldDefinitions.status,
      currentVersionNumber: customFieldDefinitions.currentVersionNumber,
      version: customFieldDefinitions.version,
      updatedAt: customFieldDefinitions.updatedAt,
      fieldVersionId: customFieldVersions.id,
      label: customFieldVersions.label,
      fieldType: customFieldVersions.fieldType,
      sectionKey: customFieldVersions.sectionKey,
      required: customFieldVersions.required,
      requiredRoles: customFieldVersions.requiredRoles,
      validation: customFieldVersions.validation,
      sortOrder: customFieldVersions.sortOrder,
    })
    .from(customFieldDefinitions)
    .innerJoin(
      customFieldVersions,
      and(
        eq(
          customFieldVersions.organizationId,
          customFieldDefinitions.organizationId
        ),
        eq(customFieldVersions.definitionId, customFieldDefinitions.id),
        eq(
          customFieldVersions.versionNumber,
          customFieldDefinitions.currentVersionNumber
        )
      )
    )
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.target, target)
      )
    )
    .orderBy(asc(customFieldVersions.sortOrder), asc(customFieldVersions.label))
}

export async function hydrateDefinitions(
  organizationId: string,
  rows: DefinitionRow[],
  transaction:
    ReturnType<typeof getDatabase> | OperationsTransaction = getDatabase()
) {
  if (!rows.length) return []
  const versionIds = rows.map((row) => row.fieldVersionId)
  const [roleRows, optionRows] = await Promise.all([
    transaction
      .select({
        fieldVersionId: customFieldVisibleRoles.fieldVersionId,
        role: customFieldVisibleRoles.role,
        kind: customFieldVisibleRoles.role,
      })
      .from(customFieldVisibleRoles)
      .where(
        and(
          eq(customFieldVisibleRoles.organizationId, organizationId),
          inArray(customFieldVisibleRoles.fieldVersionId, versionIds)
        )
      ),
    transaction
      .select({
        id: customFieldOptions.id,
        fieldVersionId: customFieldOptions.fieldVersionId,
        code: customFieldOptions.code,
        label: customFieldOptions.label,
        sortOrder: customFieldOptions.sortOrder,
        status: customFieldOptions.status,
      })
      .from(customFieldOptions)
      .where(
        and(
          eq(customFieldOptions.organizationId, organizationId),
          inArray(customFieldOptions.fieldVersionId, versionIds)
        )
      )
      .orderBy(asc(customFieldOptions.sortOrder)),
  ])
  const editableRows = await transaction
    .select({
      fieldVersionId: customFieldEditableRoles.fieldVersionId,
      role: customFieldEditableRoles.role,
    })
    .from(customFieldEditableRoles)
    .where(
      and(
        eq(customFieldEditableRoles.organizationId, organizationId),
        inArray(customFieldEditableRoles.fieldVersionId, versionIds)
      )
    )
  return rows.map((row) => ({
    ...row,
    visibleRoles: roleRows
      .filter((role) => role.fieldVersionId === row.fieldVersionId)
      .map((role) => role.role),
    editableRoles: editableRows
      .filter((role) => role.fieldVersionId === row.fieldVersionId)
      .map((role) => role.role),
    options: optionRows.filter(
      (option) => option.fieldVersionId === row.fieldVersionId
    ),
  }))
}

export async function getFormBuilder(
  actor: SafeAuthContext,
  target: CustomFieldTarget
) {
  const organizationId = requireBuilderAdmin(actor)
  const rows = await currentDefinitionRows(organizationId, target)
  return {
    target,
    sections: TARGET_SECTIONS[target],
    coreFields: PROTECTED_CORE_FIELDS[target],
    customFields: await hydrateDefinitions(organizationId, rows),
  }
}

async function insertDefinitionVersion(
  transaction: OperationsTransaction,
  actor: SafeAuthContext,
  definitionId: string,
  versionNumber: number,
  input: SaveCustomFieldDefinitionInput
) {
  const fieldVersionId = randomUUID()
  await transaction.insert(customFieldVersions).values({
    id: fieldVersionId,
    organizationId: actor.membership.organizationId,
    definitionId,
    versionNumber,
    label: input.label,
    fieldType: input.fieldType,
    sectionKey: input.sectionKey,
    required: input.required,
    requiredRoles: [...new Set(input.requiredRoles)],
    validation: {
      min: input.min,
      max: input.max,
      maxLength: input.maxLength,
      allowedDocumentTypes: input.allowedDocumentTypes,
    },
    sortOrder: input.sortOrder,
    createdByMembershipId: actor.membership.id,
  })
  const visibleRoles = [...new Set<CustomFieldRole>(input.visibleRoles)]
  const editableRoles = [...new Set<CustomFieldRole>(input.editableRoles)]
  if (visibleRoles.length)
    await transaction.insert(customFieldVisibleRoles).values(
      visibleRoles.map((role) => ({
        organizationId: actor.membership.organizationId,
        fieldVersionId,
        role,
      }))
    )
  if (editableRoles.length)
    await transaction.insert(customFieldEditableRoles).values(
      editableRoles.map((role) => ({
        organizationId: actor.membership.organizationId,
        fieldVersionId,
        role,
      }))
    )
  if (input.options.length)
    await transaction.insert(customFieldOptions).values(
      input.options.map((option, index) => ({
        organizationId: actor.membership.organizationId,
        fieldVersionId,
        code: option.code,
        label: option.label,
        sortOrder: index,
      }))
    )
  return fieldVersionId
}

function assertNotCoreField(target: CustomFieldTarget, key: string) {
  if (PROTECTED_CORE_FIELDS[target].some((field) => field.key === key))
    throw new Error("Core fields are protected and cannot be redefined.")
}

export async function saveCustomFieldDefinition(
  actor: SafeAuthContext,
  input: SaveCustomFieldDefinitionInput
) {
  const organizationId = requireBuilderAdmin(actor)
  assertNotCoreField(input.target, input.key)
  return getDatabase().transaction(async (transaction) => {
    if (!input.id) {
      const definitionId = randomUUID()
      await transaction.insert(customFieldDefinitions).values({
        id: definitionId,
        organizationId,
        target: input.target,
        key: input.key,
        createdByMembershipId: actor.membership.id,
      })
      await insertDefinitionVersion(transaction, actor, definitionId, 1, input)
      await recordOperationalMutation(transaction, actor, {
        action: "CUSTOM_FIELD_CREATED",
        message: `${actor.user.name} created custom field ${input.label}.`,
        entityType: "CUSTOM_FIELD",
        entityId: definitionId,
        after: {
          target: input.target,
          key: input.key,
          label: input.label,
          fieldType: input.fieldType,
          sectionKey: input.sectionKey,
          required: input.required,
          requiredRoles: input.requiredRoles,
          visibleRoles: input.visibleRoles,
          editableRoles: input.editableRoles,
          validation: {
            min: input.min,
            max: input.max,
            maxLength: input.maxLength,
            allowedDocumentTypes: input.allowedDocumentTypes,
          },
          options: input.options,
          sortOrder: input.sortOrder,
        },
      })
      return { id: definitionId }
    }
    const currentRows = await hydrateDefinitions(
      organizationId,
      await currentDefinitionRows(organizationId, input.target, transaction),
      transaction
    )
    const current = currentRows.find((row) => row.id === input.id)
    if (!current || current.version !== input.version)
      throw new Error("This field changed; refresh and try again.")
    const [{ valueCount }] = await transaction
      .select({ valueCount: count() })
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.organizationId, organizationId),
          eq(customFieldValues.definitionId, current.id)
        )
      )
    if (valueCount > 0 && current.key !== input.key)
      throw new Error("Internal key cannot change after the field has values.")
    if (valueCount > 0 && current.fieldType !== input.fieldType)
      throw new Error("Field type cannot change after the field has values.")
    const nextVersion = current.currentVersionNumber + 1
    await insertDefinitionVersion(
      transaction,
      actor,
      current.id,
      nextVersion,
      input
    )
    const updated = await transaction
      .update(customFieldDefinitions)
      .set({
        key: input.key,
        currentVersionNumber: nextVersion,
        updatedAt: new Date(),
        version: current.version + 1,
      })
      .where(
        and(
          eq(customFieldDefinitions.id, current.id),
          eq(customFieldDefinitions.version, current.version)
        )
      )
      .returning({ id: customFieldDefinitions.id })
    if (!updated.length)
      throw new Error("This field changed; refresh and try again.")
    await recordOperationalMutation(transaction, actor, {
      action:
        current.label === input.label
          ? "CUSTOM_FIELD_UPDATED"
          : "CUSTOM_FIELD_RENAMED",
      message: `${actor.user.name} updated custom field ${input.label}.`,
      entityType: "CUSTOM_FIELD",
      entityId: current.id,
      before: {
        key: current.key,
        label: current.label,
        fieldType: current.fieldType,
        sectionKey: current.sectionKey,
        required: current.required,
        requiredRoles: current.requiredRoles,
        visibleRoles: current.visibleRoles,
        editableRoles: current.editableRoles,
        validation: current.validation,
        options: current.options.map((option) => ({
          code: option.code,
          label: option.label,
          status: option.status,
        })),
        sortOrder: current.sortOrder,
      },
      after: {
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        sectionKey: input.sectionKey,
        required: input.required,
        requiredRoles: input.requiredRoles,
        visibleRoles: input.visibleRoles,
        editableRoles: input.editableRoles,
        validation: {
          min: input.min,
          max: input.max,
          maxLength: input.maxLength,
          allowedDocumentTypes: input.allowedDocumentTypes,
        },
        options: input.options,
        sortOrder: input.sortOrder,
      },
    })
    return { id: current.id }
  })
}

function snapshotToInput(
  row: Awaited<ReturnType<typeof hydrateDefinitions>>[number],
  overrides: Partial<SaveCustomFieldDefinitionInput> = {}
): SaveCustomFieldDefinitionInput {
  return {
    id: row.id,
    version: row.version,
    target: row.target,
    key: row.key,
    label: row.label,
    fieldType: row.fieldType,
    sectionKey: row.sectionKey,
    required: row.required,
    requiredRoles: row.requiredRoles,
    visibleRoles: row.visibleRoles,
    editableRoles: row.editableRoles,
    sortOrder: row.sortOrder,
    min: row.validation.min,
    max: row.validation.max,
    maxLength: row.validation.maxLength,
    allowedDocumentTypes: (row.validation.allowedDocumentTypes ??
      []) as SaveCustomFieldDefinitionInput["allowedDocumentTypes"],
    options: row.options.map((option) => ({
      code: option.code,
      label: option.label,
    })),
    ...overrides,
  }
}

export async function setCustomFieldStatus(
  actor: SafeAuthContext,
  input: {
    id: string
    version: number
    status: "ACTIVE" | "INACTIVE"
    reason: string
  }
) {
  const organizationId = requireBuilderAdmin(actor)
  await getDatabase().transaction(async (transaction) => {
    const rows = await currentDefinitionRows(
      organizationId,
      "DEAL",
      transaction
    )
    const allTargets: CustomFieldTarget[] = [
      "TRIP_LOADING",
      "TRIP_DELIVERY",
      "VENDOR",
      "DRIVER",
      "PAYMENT",
    ]
    for (const target of allTargets)
      rows.push(
        ...(await currentDefinitionRows(organizationId, target, transaction))
      )
    const row = rows.find((candidate) => candidate.id === input.id)
    if (!row || row.version !== input.version)
      throw new Error("This field changed; refresh and try again.")
    if (row.status === input.status) return
    const hydrated = (
      await hydrateDefinitions(organizationId, [row], transaction)
    )[0]
    const nextVersion = row.currentVersionNumber + 1
    await insertDefinitionVersion(
      transaction,
      actor,
      row.id,
      nextVersion,
      snapshotToInput(hydrated)
    )
    const updated = await transaction
      .update(customFieldDefinitions)
      .set({
        status: input.status,
        currentVersionNumber: nextVersion,
        updatedAt: new Date(),
        version: row.version + 1,
      })
      .where(
        and(
          eq(customFieldDefinitions.id, row.id),
          eq(customFieldDefinitions.version, row.version)
        )
      )
      .returning({ id: customFieldDefinitions.id })
    if (!updated.length)
      throw new Error("This field changed; refresh and try again.")
    await recordOperationalMutation(transaction, actor, {
      action:
        input.status === "ACTIVE"
          ? "CUSTOM_FIELD_ACTIVATED"
          : "CUSTOM_FIELD_DEACTIVATED",
      message: `${actor.user.name} ${input.status === "ACTIVE" ? "activated" : "deactivated"} custom field ${row.label}.`,
      entityType: "CUSTOM_FIELD",
      entityId: row.id,
      before: { status: row.status },
      after: { status: input.status },
      reason: input.reason,
    })
  })
}

export async function reorderCustomFields(
  actor: SafeAuthContext,
  input: { target: CustomFieldTarget; orderedIds: string[] }
) {
  const organizationId = requireBuilderAdmin(actor)
  await getDatabase().transaction(async (transaction) => {
    const rows = await currentDefinitionRows(
      organizationId,
      input.target,
      transaction
    )
    if (
      rows.length !== input.orderedIds.length ||
      rows.some((row) => !input.orderedIds.includes(row.id))
    )
      throw new ForbiddenError()
    const hydrated = await hydrateDefinitions(organizationId, rows, transaction)
    for (const row of hydrated) {
      const sortOrder = input.orderedIds.indexOf(row.id)
      if (row.sortOrder === sortOrder) continue
      const nextVersion = row.currentVersionNumber + 1
      await insertDefinitionVersion(
        transaction,
        actor,
        row.id,
        nextVersion,
        snapshotToInput(row, { sortOrder })
      )
      const updated = await transaction
        .update(customFieldDefinitions)
        .set({
          currentVersionNumber: nextVersion,
          updatedAt: new Date(),
          version: row.version + 1,
        })
        .where(
          and(
            eq(customFieldDefinitions.id, row.id),
            eq(customFieldDefinitions.version, row.version)
          )
        )
        .returning({ id: customFieldDefinitions.id })
      if (!updated.length)
        throw new Error("This field changed; refresh and try again.")
      await recordOperationalMutation(transaction, actor, {
        action: "CUSTOM_FIELD_REORDERED",
        message: `${actor.user.name} reordered custom field ${row.label}.`,
        entityType: "CUSTOM_FIELD",
        entityId: row.id,
        before: { sortOrder: row.sortOrder },
        after: { sortOrder },
      })
    }
  })
}

export function suggestedFieldKey(label: string): string {
  return slugifyFieldKey(label) || "custom_field"
}
