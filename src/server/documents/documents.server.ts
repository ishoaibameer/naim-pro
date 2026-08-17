import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { z } from "zod"

import { ForbiddenError, requireRole } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import {
  bills,
  deals,
  documentAttachments,
  documents,
  documentVersions,
  drivers,
  memberships,
  payments,
  trips,
  users,
  vehicles,
  vendors,
} from "@/server/db/schema"
import { recordOperationalMutation } from "@/server/operations/shared.server"
import type { OperationsTransaction } from "@/server/operations/shared.server"
import {
  authorizeDocumentRecord,
  authorizeDocumentUpload,
  authorizeDocumentTarget,
} from "./authorization.server"
import type { DocumentTarget } from "./authorization.server"
import {
  calculateSha256,
  safeOriginalFilename,
  validateDocumentFile,
} from "./file-validation.server"
import { DOCUMENT_TYPE_LABELS } from "./policy"
import type { DocumentTargetType, DocumentType } from "./policy"
import { scanDocument } from "./scanner.server"
import type { documentListSchema, retireDocumentSchema } from "./schemas"
import { createStorageKey, getDocumentStorage } from "./storage.server"

type DocumentListInput = z.infer<typeof documentListSchema>
type RetireDocumentInput = z.infer<typeof retireDocumentSchema>

export interface UploadFileInput {
  name: string
  type: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

export interface UploadDocumentInput extends DocumentTarget {
  documentType: DocumentType
  title: string
  description: string
}

const uploadedMemberships = alias(memberships, "document_uploaded_memberships")
const uploadedUsers = alias(users, "document_uploaded_users")

function attachmentValues(target: DocumentTarget) {
  return {
    dealId: target.targetType === "DEAL" ? target.targetId : null,
    tripId: target.targetType === "TRIP" ? target.targetId : null,
    paymentId: target.targetType === "PAYMENT" ? target.targetId : null,
    billId: target.targetType === "BILL" ? target.targetId : null,
    vehicleId: target.targetType === "VEHICLE" ? target.targetId : null,
    vendorId: target.targetType === "VENDOR" ? target.targetId : null,
    driverId: target.targetType === "DRIVER" ? target.targetId : null,
  }
}

function profileKey(input: UploadDocumentInput): string | null {
  return input.targetType === "VEHICLE" &&
    input.documentType === "VEHICLE_PHOTO"
    ? `VEHICLE:${input.targetId}:MASTER_PHOTO`
    : null
}

async function insertUploadAudit(
  transaction: OperationsTransaction,
  actor: SafeAuthContext,
  input: {
    documentId: string
    documentType: DocumentType
    targetType: DocumentTargetType
    targetId: string
    targetLabel: string
    versionNumber: number
    mimeType: string
    sizeBytes: number
    checksumSha256: string
    replaced: boolean
  }
) {
  await recordOperationalMutation(transaction, actor, {
    action: input.replaced ? "DOCUMENT_VERSION_UPLOADED" : "DOCUMENT_UPLOADED",
    message: `${actor.user.name} uploaded ${DOCUMENT_TYPE_LABELS[input.documentType]} for ${input.targetLabel}`,
    entityType: "DOCUMENT",
    entityId: input.documentId,
    after: {
      documentType: input.documentType,
      targetType: input.targetType,
      targetId: input.targetId,
      versionNumber: input.versionNumber,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
    },
  })
}

export async function uploadDocument(
  actor: SafeAuthContext,
  input: UploadDocumentInput,
  file: UploadFileInput
) {
  const target = await authorizeDocumentUpload(actor, input, input.documentType)
  const originalFilename = safeOriginalFilename(file.name)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = validateDocumentFile({
    declaredMimeType: file.type,
    sizeBytes: file.size,
    bytes,
  })
  const checksumSha256 = calculateSha256(bytes)
  await scanDocument(bytes)
  const organizationId = actor.membership.organizationId
  const logicalProfileKey = profileKey(input)
  const existing = logicalProfileKey
    ? (
        await getDatabase()
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.organizationId, organizationId),
              eq(documents.profileKey, logicalProfileKey)
            )
          )
          .limit(1)
      ).at(0)
    : null
  const documentId = existing?.id ?? randomUUID()
  const storageKey = createStorageKey(organizationId, documentId, mimeType)
  const storage = getDocumentStorage()
  await storage.put(storageKey, bytes, {
    contentType: mimeType,
    checksumSha256,
  })
  try {
    return await getDatabase().transaction(async (transaction) => {
      const current = existing
        ? (
            await transaction
              .select()
              .from(documents)
              .where(
                and(
                  eq(documents.organizationId, organizationId),
                  eq(documents.id, documentId)
                )
              )
              .limit(1)
              .for("update")
          ).at(0)
        : null
      const versionNumber = current ? current.currentVersionNumber + 1 : 1
      if (current) {
        await transaction
          .update(documents)
          .set({
            title: input.title || originalFilename,
            description: input.description || null,
            status: "ACTIVE",
            currentVersionNumber: versionNumber,
            retiredByMembershipId: null,
            retiredAt: null,
            retiredReason: null,
            updatedAt: new Date(),
            version: current.version + 1,
          })
          .where(
            and(
              eq(documents.id, current.id),
              eq(documents.version, current.version)
            )
          )
      } else {
        await transaction.insert(documents).values({
          id: documentId,
          organizationId,
          documentType: input.documentType,
          title: input.title || originalFilename,
          description: input.description || null,
          profileKey: logicalProfileKey,
          createdByMembershipId: actor.membership.id,
        })
        await transaction.insert(documentAttachments).values({
          organizationId,
          documentId,
          ...attachmentValues(input),
          createdByMembershipId: actor.membership.id,
        })
      }
      await transaction.insert(documentVersions).values({
        organizationId,
        documentId,
        versionNumber,
        storageKey,
        originalFilename,
        mimeType,
        sizeBytes: file.size,
        checksumSha256,
        uploadedByMembershipId: actor.membership.id,
      })
      await insertUploadAudit(transaction, actor, {
        documentId,
        documentType: input.documentType,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: target.label,
        versionNumber,
        mimeType,
        sizeBytes: file.size,
        checksumSha256,
        replaced: Boolean(current),
      })
      return { id: documentId, versionNumber }
    })
  } catch (error) {
    await storage.delete(storageKey)
    throw error
  }
}

function documentBaseQuery() {
  return getDatabase()
    .select({
      id: documents.id,
      documentType: documents.documentType,
      title: documents.title,
      description: documents.description,
      status: documents.status,
      version: documents.version,
      currentVersionNumber: documents.currentVersionNumber,
      originalFilename: documentVersions.originalFilename,
      mimeType: documentVersions.mimeType,
      sizeBytes: documentVersions.sizeBytes,
      checksumSha256: documentVersions.checksumSha256,
      uploadedByMembershipId: documentVersions.uploadedByMembershipId,
      uploadedBy: uploadedUsers.name,
      uploadedAt: documentVersions.createdAt,
      dealId: documentAttachments.dealId,
      dealNumber: deals.dealNumber,
      tripId: documentAttachments.tripId,
      tripNumber: trips.tripNumber,
      paymentId: documentAttachments.paymentId,
      paymentNumber: payments.paymentNumber,
      billId: documentAttachments.billId,
      billNumber: bills.billNumber,
      vehicleId: documentAttachments.vehicleId,
      vehicleNumber: vehicles.registrationNumber,
      vendorId: documentAttachments.vendorId,
      vendorName: vendors.name,
      driverId: documentAttachments.driverId,
      driverName: drivers.name,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      and(
        eq(documentVersions.documentId, documents.id),
        eq(documentVersions.organizationId, documents.organizationId),
        eq(documentVersions.versionNumber, documents.currentVersionNumber)
      )
    )
    .innerJoin(
      documentAttachments,
      and(
        eq(documentAttachments.documentId, documents.id),
        eq(documentAttachments.organizationId, documents.organizationId)
      )
    )
    .innerJoin(
      uploadedMemberships,
      eq(uploadedMemberships.id, documentVersions.uploadedByMembershipId)
    )
    .innerJoin(uploadedUsers, eq(uploadedUsers.id, uploadedMemberships.userId))
    .leftJoin(deals, eq(deals.id, documentAttachments.dealId))
    .leftJoin(trips, eq(trips.id, documentAttachments.tripId))
    .leftJoin(payments, eq(payments.id, documentAttachments.paymentId))
    .leftJoin(bills, eq(bills.id, documentAttachments.billId))
    .leftJoin(vehicles, eq(vehicles.id, documentAttachments.vehicleId))
    .leftJoin(vendors, eq(vendors.id, documentAttachments.vendorId))
    .leftJoin(drivers, eq(drivers.id, documentAttachments.driverId))
}

function relatedLabel(item: {
  dealNumber: string | null
  tripNumber: string | null
  paymentNumber: string | null
  billNumber: string | null
  vehicleNumber: string | null
  vendorName: string | null
  driverName: string | null
}) {
  return (
    item.dealNumber ??
    item.tripNumber ??
    item.paymentNumber ??
    item.billNumber ??
    item.vehicleNumber ??
    item.vendorName ??
    item.driverName ??
    "Unknown record"
  )
}

function relatedType(item: {
  dealId: string | null
  tripId: string | null
  paymentId: string | null
  billId: string | null
  vehicleId: string | null
  vendorId: string | null
}) {
  if (item.dealId) return "DEAL"
  if (item.tripId) return "TRIP"
  if (item.paymentId) return "PAYMENT"
  if (item.billId) return "BILL"
  if (item.vehicleId) return "VEHICLE"
  if (item.vendorId) return "VENDOR"
  return "DRIVER"
}

function presentDocument<
  T extends Parameters<typeof relatedLabel>[0] &
    Parameters<typeof relatedType>[0],
>(item: T) {
  return {
    ...item,
    relatedLabel: relatedLabel(item),
    relatedType: relatedType(item),
  }
}

export async function listDocuments(
  actor: SafeAuthContext,
  input: DocumentListInput
) {
  requireRole(actor, ["ADMIN", "MEMBER"])
  const organizationId = actor.membership.organizationId
  const search = input.search.trim()
  const where = and(
    eq(documents.organizationId, organizationId),
    input.documentType === "ALL"
      ? undefined
      : eq(documents.documentType, input.documentType),
    input.tripId ? eq(documentAttachments.tripId, input.tripId) : undefined,
    input.vehicleId
      ? eq(documentAttachments.vehicleId, input.vehicleId)
      : undefined,
    input.paymentId
      ? eq(documentAttachments.paymentId, input.paymentId)
      : undefined,
    input.billId ? eq(documentAttachments.billId, input.billId) : undefined,
    input.uploadedByMembershipId
      ? eq(
          documentVersions.uploadedByMembershipId,
          input.uploadedByMembershipId
        )
      : undefined,
    input.vendorId
      ? or(
          eq(documentAttachments.vendorId, input.vendorId),
          eq(deals.vendorId, input.vendorId),
          eq(payments.vendorId, input.vendorId),
          sql`exists (select 1 from deals document_filter_deals where document_filter_deals.id = ${trips.dealId} and document_filter_deals.vendor_id = ${input.vendorId})`
        )
      : undefined,
    input.from
      ? gte(documentVersions.createdAt, new Date(`${input.from}T00:00:00.000Z`))
      : undefined,
    input.to
      ? lte(documentVersions.createdAt, new Date(`${input.to}T23:59:59.999Z`))
      : undefined,
    search
      ? or(
          ilike(documents.title, `%${search}%`),
          ilike(documentVersions.originalFilename, `%${search}%`),
          ilike(deals.dealNumber, `%${search}%`),
          ilike(trips.tripNumber, `%${search}%`),
          ilike(payments.paymentNumber, `%${search}%`),
          ilike(bills.billNumber, `%${search}%`),
          ilike(vehicles.registrationNumber, `%${search}%`),
          ilike(vendors.name, `%${search}%`),
          ilike(drivers.name, `%${search}%`)
        )
      : undefined
  )
  const db = getDatabase()
  const [items, [total]] = await Promise.all([
    documentBaseQuery()
      .where(where)
      .orderBy(desc(documentVersions.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ value: countDistinct(documents.id) })
      .from(documents)
      .innerJoin(
        documentVersions,
        and(
          eq(documentVersions.documentId, documents.id),
          eq(documentVersions.versionNumber, documents.currentVersionNumber)
        )
      )
      .innerJoin(
        documentAttachments,
        eq(documentAttachments.documentId, documents.id)
      )
      .leftJoin(deals, eq(deals.id, documentAttachments.dealId))
      .leftJoin(trips, eq(trips.id, documentAttachments.tripId))
      .leftJoin(payments, eq(payments.id, documentAttachments.paymentId))
      .leftJoin(bills, eq(bills.id, documentAttachments.billId))
      .leftJoin(vehicles, eq(vehicles.id, documentAttachments.vehicleId))
      .leftJoin(vendors, eq(vendors.id, documentAttachments.vendorId))
      .leftJoin(drivers, eq(drivers.id, documentAttachments.driverId))
      .where(where),
  ])
  return {
    items: items.map((item) => presentDocument(item)),
    total: total.value,
    page: input.page,
    pageSize: input.pageSize,
  }
}

export async function listDocumentsForTarget(
  actor: SafeAuthContext,
  target: DocumentTarget
) {
  await authorizeDocumentTarget(actor, target, "VIEW")
  const column =
    target.targetType === "DEAL"
      ? documentAttachments.dealId
      : target.targetType === "TRIP"
        ? documentAttachments.tripId
        : target.targetType === "PAYMENT"
          ? documentAttachments.paymentId
          : target.targetType === "BILL"
            ? documentAttachments.billId
            : target.targetType === "VEHICLE"
              ? documentAttachments.vehicleId
              : target.targetType === "VENDOR"
                ? documentAttachments.vendorId
                : documentAttachments.driverId
  const rows = await documentBaseQuery()
    .where(
      and(
        eq(documents.organizationId, actor.membership.organizationId),
        eq(column, target.targetId)
      )
    )
    .orderBy(desc(documentVersions.createdAt))
  return rows.map((item) => presentDocument(item))
}

export async function getDocument(actor: SafeAuthContext, documentId: string) {
  await authorizeDocumentRecord(actor, documentId)
  const document = (
    await documentBaseQuery()
      .where(
        and(
          eq(documents.organizationId, actor.membership.organizationId),
          eq(documents.id, documentId)
        )
      )
      .limit(1)
  ).at(0)
  if (!document) throw new ForbiddenError()
  const versions = await getDatabase()
    .select({
      id: documentVersions.id,
      versionNumber: documentVersions.versionNumber,
      originalFilename: documentVersions.originalFilename,
      mimeType: documentVersions.mimeType,
      sizeBytes: documentVersions.sizeBytes,
      checksumSha256: documentVersions.checksumSha256,
      uploadedBy: uploadedUsers.name,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .innerJoin(
      uploadedMemberships,
      eq(uploadedMemberships.id, documentVersions.uploadedByMembershipId)
    )
    .innerJoin(uploadedUsers, eq(uploadedUsers.id, uploadedMemberships.userId))
    .where(
      and(
        eq(documentVersions.organizationId, actor.membership.organizationId),
        eq(documentVersions.documentId, documentId)
      )
    )
    .orderBy(desc(documentVersions.versionNumber))
  return { ...presentDocument(document), versions }
}

export async function readDocumentContent(
  actor: SafeAuthContext,
  documentId: string,
  versionNumber?: number
) {
  await authorizeDocumentRecord(actor, documentId)
  const record = (
    await getDatabase()
      .select({
        originalFilename: documentVersions.originalFilename,
        mimeType: documentVersions.mimeType,
        sizeBytes: documentVersions.sizeBytes,
        checksumSha256: documentVersions.checksumSha256,
        storageKey: documentVersions.storageKey,
      })
      .from(documentVersions)
      .innerJoin(documents, eq(documents.id, documentVersions.documentId))
      .where(
        and(
          eq(documentVersions.organizationId, actor.membership.organizationId),
          eq(documentVersions.documentId, documentId),
          versionNumber
            ? eq(documentVersions.versionNumber, versionNumber)
            : eq(documentVersions.versionNumber, documents.currentVersionNumber)
        )
      )
      .limit(1)
  ).at(0)
  if (!record) throw new ForbiddenError()
  const storage = getDocumentStorage()
  const [bytes, metadata] = await Promise.all([
    storage.read(record.storageKey),
    storage.metadata(record.storageKey),
  ])
  if (
    metadata.sizeBytes !== record.sizeBytes ||
    bytes.byteLength !== record.sizeBytes ||
    calculateSha256(bytes) !== record.checksumSha256
  )
    throw new Error("Stored document integrity verification failed.")
  return { ...record, bytes }
}

export async function retireDocument(
  actor: SafeAuthContext,
  input: RetireDocumentInput
) {
  requireRole(actor, ["ADMIN"])
  const organizationId = actor.membership.organizationId
  return getDatabase().transaction(async (transaction) => {
    const current = (
      await transaction
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.organizationId, organizationId),
            eq(documents.id, input.id)
          )
        )
        .limit(1)
        .for("update")
    ).at(0)
    if (!current) throw new ForbiddenError()
    if (current.version !== input.version)
      throw new Error("This Document changed; refresh and try again.")
    if (current.status !== "ACTIVE")
      throw new Error("Only an active Document can be superseded.")
    const now = new Date()
    const updated = await transaction
      .update(documents)
      .set({
        status: "INACTIVE",
        retiredByMembershipId: actor.membership.id,
        retiredAt: now,
        retiredReason: input.reason,
        updatedAt: now,
        version: current.version + 1,
      })
      .where(
        and(
          eq(documents.id, current.id),
          eq(documents.version, current.version)
        )
      )
      .returning({ id: documents.id })
    if (!updated.length)
      throw new Error("This Document changed; refresh and try again.")
    await recordOperationalMutation(transaction, actor, {
      action: "DOCUMENT_SUPERSEDED",
      message: `${actor.user.name} superseded ${DOCUMENT_TYPE_LABELS[current.documentType]}`,
      entityType: "DOCUMENT",
      entityId: current.id,
      before: { status: current.status, version: current.version },
      after: { status: "INACTIVE", version: current.version + 1 },
      reason: input.reason,
    })
  })
}

export async function getDocumentMasters(actor: SafeAuthContext) {
  requireRole(actor, ["ADMIN", "MEMBER"])
  const organizationId = actor.membership.organizationId
  const db = getDatabase()
  const [
    dealRows,
    tripRows,
    paymentRows,
    billRows,
    vehicleRows,
    vendorRows,
    driverRows,
    memberRows,
  ] = await Promise.all([
    db
      .select({ id: deals.id, label: deals.dealNumber })
      .from(deals)
      .where(eq(deals.organizationId, organizationId))
      .orderBy(asc(deals.dealNumber)),
    db
      .select({ id: trips.id, label: trips.tripNumber })
      .from(trips)
      .where(eq(trips.organizationId, organizationId))
      .orderBy(asc(trips.tripNumber)),
    db
      .select({ id: payments.id, label: payments.paymentNumber })
      .from(payments)
      .where(eq(payments.organizationId, organizationId))
      .orderBy(desc(payments.createdAt))
      .limit(100),
    db
      .select({ id: bills.id, label: bills.billNumber })
      .from(bills)
      .where(eq(bills.organizationId, organizationId))
      .orderBy(desc(bills.createdAt))
      .limit(100),
    db
      .select({ id: vehicles.id, label: vehicles.registrationNumber })
      .from(vehicles)
      .where(eq(vehicles.organizationId, organizationId))
      .orderBy(asc(vehicles.registrationNumber)),
    db
      .select({ id: vendors.id, label: vendors.name })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId))
      .orderBy(asc(vendors.name)),
    db
      .select({ id: drivers.id, label: drivers.name })
      .from(drivers)
      .where(eq(drivers.organizationId, organizationId))
      .orderBy(asc(drivers.name)),
    db
      .select({ id: memberships.id, label: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.status, "ACTIVE")
        )
      )
      .orderBy(asc(users.name)),
  ])
  return {
    DEAL: dealRows,
    TRIP: tripRows,
    PAYMENT: paymentRows,
    BILL: billRows,
    VEHICLE: vehicleRows,
    VENDOR: vendorRows,
    DRIVER: driverRows,
    members: memberRows,
  }
}
