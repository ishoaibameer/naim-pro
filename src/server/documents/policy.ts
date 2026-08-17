import type { AuthRole } from "@/server/auth/types"
import type { DOCUMENT_TYPE_VALUES } from "@/server/db/schema"

export type DocumentType = (typeof DOCUMENT_TYPE_VALUES)[number]
export const DOCUMENT_TARGET_VALUES = [
  "DEAL",
  "TRIP",
  "PAYMENT",
  "BILL",
  "VEHICLE",
  "VENDOR",
  "DRIVER",
] as const
export type DocumentTargetType = (typeof DOCUMENT_TARGET_VALUES)[number]
export class DocumentPolicyError extends Error {}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  VEHICLE_PHOTO: "Vehicle Photo",
  LOADING_PHOTO: "Loading Photo",
  WEIGHBRIDGE_SLIP: "Kanta / Weighbridge Slip",
  PAYMENT_RECEIPT: "Payment Receipt",
  DELIVERY_CHALLAN: "Delivery Challan",
  BILL: "Bill Copy",
  PERMIT: "Permit",
  OTHER: "Other Supporting Document",
}

const TARGET_DOCUMENT_TYPES: Record<
  DocumentTargetType,
  readonly DocumentType[]
> = {
  DEAL: ["PERMIT", "OTHER"],
  TRIP: [
    "LOADING_PHOTO",
    "WEIGHBRIDGE_SLIP",
    "DELIVERY_CHALLAN",
    "PERMIT",
    "OTHER",
  ],
  PAYMENT: ["PAYMENT_RECEIPT", "OTHER"],
  BILL: ["BILL", "OTHER"],
  VEHICLE: ["VEHICLE_PHOTO", "PERMIT", "OTHER"],
  VENDOR: ["PERMIT", "OTHER"],
  DRIVER: ["PERMIT", "OTHER"],
}

export function allowedDocumentTypes(
  targetType: DocumentTargetType
): readonly DocumentType[] {
  return TARGET_DOCUMENT_TYPES[targetType]
}

export function assertDocumentTypeForTarget(
  targetType: DocumentTargetType,
  documentType: DocumentType
): void {
  if (!TARGET_DOCUMENT_TYPES[targetType].includes(documentType)) {
    throw new DocumentPolicyError(
      "This document type is not allowed for the selected record."
    )
  }
}

export function canRoleUploadDocument(
  role: AuthRole,
  targetType: DocumentTargetType,
  documentType: DocumentType
): boolean {
  if (!TARGET_DOCUMENT_TYPES[targetType].includes(documentType)) return false
  if (role === "ADMIN" || role === "MEMBER") return true
  if (role === "VENDOR") {
    return ["VENDOR", "DEAL", "TRIP"].includes(targetType)
  }
  return (
    targetType === "TRIP" &&
    ["LOADING_PHOTO", "WEIGHBRIDGE_SLIP", "DELIVERY_CHALLAN", "OTHER"].includes(
      documentType
    )
  )
}
