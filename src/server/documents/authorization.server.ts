import "@tanstack/react-start/server-only"

import { and, eq, isNull } from "drizzle-orm"

import { ForbiddenError, requireMembership } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  deals,
  documentAttachments,
  drivers,
  payments,
  tripAssignments,
  trips,
  vehicles,
  vendors,
} from "@/server/db/schema"
import { assertDocumentTypeForTarget, canRoleUploadDocument } from "./policy"
import type { DocumentTargetType, DocumentType } from "./policy"

export interface DocumentTarget {
  targetType: DocumentTargetType
  targetId: string
}

interface TargetContext extends DocumentTarget {
  organizationId: string
  label: string
  vendorId: string | null
  driverId: string | null
  vehicleId: string | null
}

async function loadTarget(
  organizationId: string,
  target: DocumentTarget
): Promise<TargetContext | null> {
  const db = getDatabase()
  if (target.targetType === "DEAL") {
    const row = (
      await db
        .select({
          organizationId: deals.organizationId,
          label: deals.dealNumber,
          vendorId: deals.vendorId,
        })
        .from(deals)
        .where(
          and(
            eq(deals.organizationId, organizationId),
            eq(deals.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row ? { ...target, ...row, driverId: null, vehicleId: null } : null
  }
  if (target.targetType === "TRIP") {
    const row = (
      await db
        .select({
          organizationId: trips.organizationId,
          label: trips.tripNumber,
          vendorId: deals.vendorId,
          driverId: trips.currentDriverId,
          vehicleId: trips.currentVehicleId,
        })
        .from(trips)
        .innerJoin(deals, eq(deals.id, trips.dealId))
        .where(
          and(
            eq(trips.organizationId, organizationId),
            eq(trips.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row ? { ...target, ...row } : null
  }
  if (target.targetType === "PAYMENT") {
    const row = (
      await db
        .select({
          organizationId: payments.organizationId,
          label: payments.paymentNumber,
          vendorId: payments.vendorId,
        })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row ? { ...target, ...row, driverId: null, vehicleId: null } : null
  }
  if (target.targetType === "BILL") {
    const row = (
      await db
        .select({
          organizationId: bills.organizationId,
          label: bills.billNumber,
        })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            eq(bills.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row
      ? { ...target, ...row, vendorId: null, driverId: null, vehicleId: null }
      : null
  }
  if (target.targetType === "VEHICLE") {
    const row = (
      await db
        .select({
          organizationId: vehicles.organizationId,
          label: vehicles.registrationNumber,
        })
        .from(vehicles)
        .where(
          and(
            eq(vehicles.organizationId, organizationId),
            eq(vehicles.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row
      ? {
          ...target,
          ...row,
          vendorId: null,
          driverId: null,
          vehicleId: target.targetId,
        }
      : null
  }
  if (target.targetType === "VENDOR") {
    const row = (
      await db
        .select({ organizationId: vendors.organizationId, label: vendors.name })
        .from(vendors)
        .where(
          and(
            eq(vendors.organizationId, organizationId),
            eq(vendors.id, target.targetId)
          )
        )
        .limit(1)
    ).at(0)
    return row
      ? {
          ...target,
          ...row,
          vendorId: target.targetId,
          driverId: null,
          vehicleId: null,
        }
      : null
  }
  const row = (
    await db
      .select({ organizationId: drivers.organizationId, label: drivers.name })
      .from(drivers)
      .where(
        and(
          eq(drivers.organizationId, organizationId),
          eq(drivers.id, target.targetId)
        )
      )
      .limit(1)
  ).at(0)
  return row
    ? {
        ...target,
        ...row,
        vendorId: null,
        driverId: target.targetId,
        vehicleId: null,
      }
    : null
}

async function linkedVendorId(actor: SafeAuthContext): Promise<string | null> {
  return (
    (
      await getDatabase()
        .select({ id: vendors.id })
        .from(vendors)
        .where(
          and(
            eq(vendors.organizationId, actor.membership.organizationId),
            eq(vendors.userId, actor.user.id)
          )
        )
        .limit(1)
    ).at(0)?.id ?? null
  )
}

async function linkedDriverId(actor: SafeAuthContext): Promise<string | null> {
  return (
    (
      await getDatabase()
        .select({ id: drivers.id })
        .from(drivers)
        .where(
          and(
            eq(drivers.organizationId, actor.membership.organizationId),
            eq(drivers.userId, actor.user.id),
            eq(drivers.status, "ACTIVE")
          )
        )
        .limit(1)
    ).at(0)?.id ?? null
  )
}

async function driverHasAssignment(
  organizationId: string,
  driverId: string,
  target: TargetContext,
  requireCurrent: boolean
): Promise<boolean> {
  const assignment = (
    await getDatabase()
      .select({ id: tripAssignments.id })
      .from(tripAssignments)
      .where(
        and(
          eq(tripAssignments.organizationId, organizationId),
          eq(tripAssignments.driverId, driverId),
          target.targetType === "TRIP"
            ? eq(tripAssignments.tripId, target.targetId)
            : target.targetType === "VEHICLE"
              ? eq(tripAssignments.vehicleId, target.targetId)
              : undefined,
          requireCurrent ? isNull(tripAssignments.endedAt) : undefined
        )
      )
      .limit(1)
  ).at(0)
  return Boolean(assignment)
}

export async function authorizeDocumentTarget(
  actor: SafeAuthContext,
  target: DocumentTarget,
  mode: "VIEW" | "UPLOAD" | "EDIT"
): Promise<TargetContext> {
  requireMembership(actor)
  const context = await loadTarget(actor.membership.organizationId, target)
  if (!context) throw new ForbiddenError()
  assertDocumentOrganizationAccess(actor, context.organizationId)
  if (actor.membership.role === "ADMIN" || actor.membership.role === "MEMBER")
    return context
  if (actor.membership.role === "VENDOR") {
    const vendorId = await linkedVendorId(actor)
    if (!vendorId || context.vendorId !== vendorId) throw new ForbiddenError()
    return context
  }
  const driverId = await linkedDriverId(actor)
  if (!driverId) throw new ForbiddenError()
  if (
    context.targetType === "DRIVER" &&
    context.driverId === driverId &&
    mode !== "UPLOAD"
  )
    return context
  if (
    !["TRIP", "VEHICLE"].includes(context.targetType) ||
    (mode !== "VIEW" &&
      context.targetType === "TRIP" &&
      context.driverId !== driverId) ||
    !(await driverHasAssignment(
      actor.membership.organizationId,
      driverId,
      context,
      mode !== "VIEW"
    ))
  )
    throw new ForbiddenError()
  return context
}

export function assertDocumentOrganizationAccess(
  actor: SafeAuthContext,
  targetOrganizationId: string
): void {
  requireMembership(actor)
  if (actor.membership.organizationId !== targetOrganizationId)
    throw new ForbiddenError()
}

export async function authorizeDocumentUpload(
  actor: SafeAuthContext,
  target: DocumentTarget,
  documentType: DocumentType
): Promise<TargetContext> {
  assertDocumentTypeForTarget(target.targetType, documentType)
  if (
    !canRoleUploadDocument(
      actor.membership.role,
      target.targetType,
      documentType
    )
  )
    throw new ForbiddenError()
  return authorizeDocumentTarget(actor, target, "UPLOAD")
}

export async function authorizeDocumentRecord(
  actor: SafeAuthContext,
  documentId: string
): Promise<void> {
  const attachments = await getDatabase()
    .select({
      dealId: documentAttachments.dealId,
      tripId: documentAttachments.tripId,
      paymentId: documentAttachments.paymentId,
      billId: documentAttachments.billId,
      vehicleId: documentAttachments.vehicleId,
      vendorId: documentAttachments.vendorId,
      driverId: documentAttachments.driverId,
    })
    .from(documentAttachments)
    .where(
      and(
        eq(documentAttachments.organizationId, actor.membership.organizationId),
        eq(documentAttachments.documentId, documentId)
      )
    )
  if (!attachments.length) throw new ForbiddenError()
  for (const attachment of attachments) {
    const target = attachment.dealId
      ? { targetType: "DEAL" as const, targetId: attachment.dealId }
      : attachment.tripId
        ? { targetType: "TRIP" as const, targetId: attachment.tripId }
        : attachment.paymentId
          ? { targetType: "PAYMENT" as const, targetId: attachment.paymentId }
          : attachment.billId
            ? { targetType: "BILL" as const, targetId: attachment.billId }
            : attachment.vehicleId
              ? {
                  targetType: "VEHICLE" as const,
                  targetId: attachment.vehicleId,
                }
              : attachment.vendorId
                ? {
                    targetType: "VENDOR" as const,
                    targetId: attachment.vendorId,
                  }
                : attachment.driverId
                  ? {
                      targetType: "DRIVER" as const,
                      targetId: attachment.driverId,
                    }
                  : null
    if (!target) throw new ForbiddenError()
    await authorizeDocumentTarget(actor, target, "VIEW")
  }
}
