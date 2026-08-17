import { z } from "zod"

import { DOCUMENT_TYPE_VALUES } from "@/server/db/schema/constants"
import { DOCUMENT_TARGET_VALUES } from "./policy"

const uuid = z.string().uuid()

export const documentUploadMetadataSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  targetType: z.enum(DOCUMENT_TARGET_VALUES),
  targetId: uuid,
  title: z.string().trim().max(240).default(""),
  description: z.string().trim().max(2000).default(""),
})

export const documentListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  documentType: z.enum([...DOCUMENT_TYPE_VALUES, "ALL"]).catch("ALL"),
  vendorId: uuid.optional().catch(undefined),
  tripId: uuid.optional().catch(undefined),
  vehicleId: uuid.optional().catch(undefined),
  paymentId: uuid.optional().catch(undefined),
  billId: uuid.optional().catch(undefined),
  uploadedByMembershipId: uuid.optional().catch(undefined),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
})

export const documentIdSchema = z.object({ id: uuid })
export const documentTargetSchema = z.object({
  targetType: z.enum(DOCUMENT_TARGET_VALUES),
  targetId: uuid,
})

export const retireDocumentSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
})

export const documentCreateSearchSchema = z.object({
  targetType: z.enum(DOCUMENT_TARGET_VALUES).optional().catch(undefined),
  targetId: uuid.optional().catch(undefined),
  documentType: z.enum(DOCUMENT_TYPE_VALUES).optional().catch(undefined),
})
