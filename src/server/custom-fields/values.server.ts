import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"

import { ForbiddenError, requireMembership } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  auditEvents,
  customFieldDefinitions,
  customFieldValues,
  deals,
  documentAttachments,
  documents,
  documentVersions,
  trips,
} from "@/server/db/schema"
import {
  authorizeDocumentRecord,
  authorizeDocumentTarget,
} from "@/server/documents/authorization.server"
import type { DocumentTarget } from "@/server/documents/authorization.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import { currentDefinitionRows, hydrateDefinitions } from "./builder.server"
import type {
  CustomFieldRole,
  CustomFieldTarget,
  CustomFieldType,
} from "./config"
import type { SaveCustomFieldValuesInput } from "./schemas"
import { isEmptyCustomFieldValue, validateCustomFieldValue } from "./validation"

function resourceTarget(
  target: CustomFieldTarget,
  recordId: string
): DocumentTarget {
  if (target === "TRIP_LOADING" || target === "TRIP_DELIVERY")
    return { targetType: "TRIP", targetId: recordId }
  return { targetType: target, targetId: recordId }
}

function targetValues(target: CustomFieldTarget, recordId: string) {
  return {
    dealId: target === "DEAL" ? recordId : null,
    tripId:
      target === "TRIP_LOADING" || target === "TRIP_DELIVERY" ? recordId : null,
    vendorId: target === "VENDOR" ? recordId : null,
    driverId: target === "DRIVER" ? recordId : null,
    paymentId: target === "PAYMENT" ? recordId : null,
  }
}

function valueTargetCondition(target: CustomFieldTarget, recordId: string) {
  if (target === "DEAL") return eq(customFieldValues.dealId, recordId)
  if (target === "TRIP_LOADING" || target === "TRIP_DELIVERY")
    return eq(customFieldValues.tripId, recordId)
  if (target === "VENDOR") return eq(customFieldValues.vendorId, recordId)
  if (target === "DRIVER") return eq(customFieldValues.driverId, recordId)
  return eq(customFieldValues.paymentId, recordId)
}

async function stageIsEditable(
  actor: SafeAuthContext,
  target: CustomFieldTarget,
  recordId: string,
  transaction:
    ReturnType<typeof getDatabase> | OperationsTransaction = getDatabase()
): Promise<boolean> {
  const organizationId = actor.membership.organizationId
  if (target === "TRIP_LOADING" || target === "TRIP_DELIVERY") {
    const trip = (
      await transaction
        .select({ status: trips.status })
        .from(trips)
        .where(
          and(eq(trips.organizationId, organizationId), eq(trips.id, recordId))
        )
        .limit(1)
    ).at(0)
    if (!trip) throw new ForbiddenError()
    return target === "TRIP_LOADING"
      ? trip.status === "LOADING"
      : trip.status === "IN_TRANSIT"
  }
  if (target === "DEAL") {
    const deal = (
      await transaction
        .select({ status: deals.status })
        .from(deals)
        .where(
          and(eq(deals.organizationId, organizationId), eq(deals.id, recordId))
        )
        .limit(1)
    ).at(0)
    if (!deal) throw new ForbiddenError()
    return deal.status === "DRAFT" || deal.status === "ACTIVE"
  }
  return true
}

function roleCanSee(
  role: CustomFieldRole,
  roles: readonly CustomFieldRole[]
): boolean {
  return role === "ADMIN" || roles.includes(role)
}

function roleCanEdit(
  role: CustomFieldRole,
  roles: readonly CustomFieldRole[]
): boolean {
  return role === "ADMIN" || roles.includes(role)
}

async function loadValues(
  organizationId: string,
  target: CustomFieldTarget,
  recordId: string,
  transaction:
    ReturnType<typeof getDatabase> | OperationsTransaction = getDatabase()
) {
  return transaction
    .select({
      id: customFieldValues.id,
      definitionId: customFieldValues.definitionId,
      definitionVersionId: customFieldValues.definitionVersionId,
      value: customFieldValues.value,
      version: customFieldValues.version,
      updatedAt: customFieldValues.updatedAt,
    })
    .from(customFieldValues)
    .innerJoin(
      customFieldDefinitions,
      and(
        eq(
          customFieldDefinitions.organizationId,
          customFieldValues.organizationId
        ),
        eq(customFieldDefinitions.id, customFieldValues.definitionId),
        eq(customFieldDefinitions.target, target)
      )
    )
    .where(
      and(
        eq(customFieldValues.organizationId, organizationId),
        valueTargetCondition(target, recordId)
      )
    )
}

export async function getCustomFieldDefinitionsForCreate(
  actor: SafeAuthContext,
  target: CustomFieldTarget
) {
  requireMembership(actor)
  if (actor.membership.role !== "ADMIN" && actor.membership.role !== "MEMBER")
    throw new ForbiddenError()
  const organizationId = actor.membership.organizationId
  const definitions = await hydrateDefinitions(
    organizationId,
    await currentDefinitionRows(organizationId, target)
  )
  return {
    target,
    recordId: null,
    fields: definitions
      .filter(
        (field) =>
          field.status === "ACTIVE" &&
          roleCanSee(actor.membership.role, field.visibleRoles)
      )
      .map((field) => ({
        ...field,
        value: null,
        valueVersion: null,
        historical: false,
        canEdit: roleCanEdit(actor.membership.role, field.editableRoles),
      })),
  }
}

export async function validateCustomFieldValuesForCreate(
  actor: SafeAuthContext,
  input: Pick<SaveCustomFieldValuesInput, "target" | "values">
) {
  requireMembership(actor)
  if (actor.membership.role !== "ADMIN" && actor.membership.role !== "MEMBER")
    throw new ForbiddenError()
  const uniqueIds = new Set(input.values.map((value) => value.definitionId))
  if (uniqueIds.size !== input.values.length)
    throw new Error("A custom field was submitted more than once.")
  const definitions = await hydrateDefinitions(
    actor.membership.organizationId,
    await currentDefinitionRows(actor.membership.organizationId, input.target)
  )
  const active = definitions.filter((field) => field.status === "ACTIVE")
  const activeById = new Map(active.map((field) => [field.id, field]))
  const submittedByDefinition = new Map(
    input.values.map((value) => [value.definitionId, value.value])
  )
  for (const submitted of input.values) {
    const field = activeById.get(submitted.definitionId)
    if (!field || !roleCanEdit(actor.membership.role, field.editableRoles))
      throw new ForbiddenError()
    if (
      (field.fieldType === "IMAGE" || field.fieldType === "DOCUMENT") &&
      !isEmptyCustomFieldValue(submitted.value)
    )
      throw new Error("Upload custom documents after creating the record.")
  }
  for (const field of active) {
    if (!roleCanEdit(actor.membership.role, field.editableRoles)) continue
    const required =
      field.required &&
      (field.requiredRoles.length === 0 ||
        field.requiredRoles.includes(actor.membership.role))
    validateCustomFieldValue(
      { ...field, required, options: field.options },
      submittedByDefinition.get(field.id)
    )
  }
  return { success: true }
}

export async function getCustomFieldData(
  actor: SafeAuthContext,
  target: CustomFieldTarget,
  recordId: string
) {
  requireMembership(actor)
  const targetResource = resourceTarget(target, recordId)
  await authorizeDocumentTarget(actor, targetResource, "VIEW")
  let targetEditable = true
  if (actor.membership.role === "DRIVER") {
    try {
      await authorizeDocumentTarget(actor, targetResource, "EDIT")
    } catch {
      targetEditable = false
    }
  }
  const organizationId = actor.membership.organizationId
  const [definitions, values, editableStage] = await Promise.all([
    currentDefinitionRows(organizationId, target).then((rows) =>
      hydrateDefinitions(organizationId, rows)
    ),
    loadValues(organizationId, target, recordId),
    stageIsEditable(actor, target, recordId),
  ])
  const valuesByDefinition = new Map(
    values.map((value) => [value.definitionId, value])
  )
  return {
    target,
    recordId,
    fields: definitions
      .filter((field) => {
        const value = valuesByDefinition.get(field.id)
        return (
          roleCanSee(actor.membership.role, field.visibleRoles) &&
          (field.status === "ACTIVE" || Boolean(value))
        )
      })
      .map((field) => {
        const value = valuesByDefinition.get(field.id)
        return {
          ...field,
          value: value?.value ?? null,
          valueVersion: value?.version ?? null,
          historical: field.status !== "ACTIVE",
          canEdit:
            field.status === "ACTIVE" &&
            targetEditable &&
            editableStage &&
            roleCanEdit(actor.membership.role, field.editableRoles) &&
            !(
              actor.membership.role === "DRIVER" &&
              target === "DRIVER" &&
              (field.fieldType === "IMAGE" || field.fieldType === "DOCUMENT")
            ),
        }
      }),
  }
}

async function validateDocumentValue(
  actor: SafeAuthContext,
  target: CustomFieldTarget,
  recordId: string,
  field: {
    fieldType: CustomFieldType
    validation: { allowedDocumentTypes?: string[] }
  },
  documentId: string
) {
  await authorizeDocumentRecord(actor, documentId)
  const attachmentTarget = resourceTarget(target, recordId)
  const targetCondition =
    attachmentTarget.targetType === "DEAL"
      ? eq(documentAttachments.dealId, recordId)
      : attachmentTarget.targetType === "TRIP"
        ? eq(documentAttachments.tripId, recordId)
        : attachmentTarget.targetType === "PAYMENT"
          ? eq(documentAttachments.paymentId, recordId)
          : attachmentTarget.targetType === "VENDOR"
            ? eq(documentAttachments.vendorId, recordId)
            : eq(documentAttachments.driverId, recordId)
  const record = (
    await getDatabase()
      .select({
        documentType: documents.documentType,
        mimeType: documentVersions.mimeType,
      })
      .from(documents)
      .innerJoin(
        documentAttachments,
        and(
          eq(documentAttachments.organizationId, documents.organizationId),
          eq(documentAttachments.documentId, documents.id)
        )
      )
      .innerJoin(
        documentVersions,
        and(
          eq(documentVersions.organizationId, documents.organizationId),
          eq(documentVersions.documentId, documents.id),
          eq(documentVersions.versionNumber, documents.currentVersionNumber)
        )
      )
      .where(
        and(
          eq(documents.organizationId, actor.membership.organizationId),
          eq(documents.id, documentId),
          eq(documents.status, "ACTIVE"),
          targetCondition
        )
      )
      .limit(1)
  ).at(0)
  if (!record) throw new ForbiddenError()
  if (field.fieldType === "IMAGE" && !record.mimeType.startsWith("image/"))
    throw new Error("Choose an uploaded image.")
  const allowed = field.validation.allowedDocumentTypes ?? []
  if (allowed.length && !allowed.includes(record.documentType))
    throw new Error("This document type is not allowed for the field.")
}

async function recordValueAudit(
  transaction: OperationsTransaction,
  actor: SafeAuthContext,
  input: {
    valueId: string
    definitionId: string
    target: CustomFieldTarget
    recordId: string
    before: unknown
    after: unknown
  }
) {
  await transaction.insert(auditEvents).values({
    organizationId: actor.membership.organizationId,
    actorUserId: actor.user.id,
    actorMembershipId: actor.membership.id,
    action: "CUSTOM_FIELD_VALUE_SAVED",
    entityType: "CUSTOM_FIELD_VALUE",
    entityId: input.valueId,
    before: { definitionId: input.definitionId, value: input.before },
    after: {
      definitionId: input.definitionId,
      target: input.target,
      recordId: input.recordId,
      value: input.after,
    },
  })
}

export async function saveCustomFieldValues(
  actor: SafeAuthContext,
  input: SaveCustomFieldValuesInput
) {
  requireMembership(actor)
  await authorizeDocumentTarget(
    actor,
    resourceTarget(input.target, input.recordId),
    "EDIT"
  )
  const organizationId = actor.membership.organizationId
  const uniqueIds = new Set(input.values.map((value) => value.definitionId))
  if (uniqueIds.size !== input.values.length)
    throw new Error("A custom field was submitted more than once.")
  await getDatabase().transaction(async (transaction) => {
    if (
      !(await stageIsEditable(actor, input.target, input.recordId, transaction))
    )
      throw new Error("Custom fields are locked for this record stage.")
    const definitions = await hydrateDefinitions(
      organizationId,
      await currentDefinitionRows(organizationId, input.target, transaction),
      transaction
    )
    const active = definitions.filter((field) => field.status === "ACTIVE")
    const activeById = new Map(active.map((field) => [field.id, field]))
    for (const submitted of input.values) {
      const field = activeById.get(submitted.definitionId)
      if (!field || !roleCanEdit(actor.membership.role, field.editableRoles))
        throw new ForbiddenError()
    }
    const existing = await loadValues(
      organizationId,
      input.target,
      input.recordId,
      transaction
    )
    const existingByDefinition = new Map(
      existing.map((value) => [value.definitionId, value])
    )
    const submittedByDefinition = new Map(
      input.values.map((value) => [value.definitionId, value.value])
    )
    for (const field of active) {
      if (!roleCanEdit(actor.membership.role, field.editableRoles)) continue
      const applies =
        field.required &&
        (field.requiredRoles.length === 0 ||
          field.requiredRoles.includes(actor.membership.role))
      if (!applies) continue
      const candidate = submittedByDefinition.has(field.id)
        ? submittedByDefinition.get(field.id)
        : existingByDefinition.get(field.id)?.value
      if (isEmptyCustomFieldValue(candidate))
        throw new Error(`${field.label} is required.`)
    }
    for (const submitted of input.values) {
      const field = activeById.get(submitted.definitionId)
      if (!field) throw new ForbiddenError()
      const required =
        field.required &&
        (field.requiredRoles.length === 0 ||
          field.requiredRoles.includes(actor.membership.role))
      const normalized = validateCustomFieldValue(
        { ...field, required, options: field.options },
        submitted.value
      )
      if (
        (field.fieldType === "IMAGE" || field.fieldType === "DOCUMENT") &&
        typeof normalized === "string"
      )
        await validateDocumentValue(
          actor,
          input.target,
          input.recordId,
          field,
          normalized
        )
      const previous = existingByDefinition.get(field.id)
      if (previous) {
        if (JSON.stringify(previous.value) === JSON.stringify(normalized))
          continue
        const updated = await transaction
          .update(customFieldValues)
          .set({
            definitionVersionId: field.fieldVersionId,
            value: normalized,
            updatedByMembershipId: actor.membership.id,
            updatedAt: new Date(),
            version: previous.version + 1,
          })
          .where(
            and(
              eq(customFieldValues.organizationId, organizationId),
              eq(customFieldValues.id, previous.id),
              eq(customFieldValues.version, previous.version)
            )
          )
          .returning({ id: customFieldValues.id })
        if (!updated.length)
          throw new Error(
            "This custom field value changed; refresh and try again."
          )
        await recordValueAudit(transaction, actor, {
          valueId: previous.id,
          definitionId: field.id,
          target: input.target,
          recordId: input.recordId,
          before: previous.value,
          after: normalized,
        })
      } else {
        const valueId = randomUUID()
        await transaction.insert(customFieldValues).values({
          id: valueId,
          organizationId,
          definitionId: field.id,
          definitionVersionId: field.fieldVersionId,
          value: normalized,
          ...targetValues(input.target, input.recordId),
          createdByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
        })
        await recordValueAudit(transaction, actor, {
          valueId,
          definitionId: field.id,
          target: input.target,
          recordId: input.recordId,
          before: null,
          after: normalized,
        })
      }
    }
  })
  return { success: true }
}
