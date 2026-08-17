import { z } from "zod"

import { DOCUMENT_TYPE_VALUES } from "@/server/db/schema/constants"

const uuid = z.string().uuid()

export const vendorLoadListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z
    .enum(["ALL", "ACTIVE", "IN_TRANSIT", "DELIVERED", "ARCHIVED"])
    .catch("ALL"),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
})

export const vendorDocumentListSchema = z.object({
  tripId: uuid.optional().catch(undefined),
  documentType: z.enum([...DOCUMENT_TYPE_VALUES, "ALL"]).catch("ALL"),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
})

export const vendorEntitySchema = z.object({ id: uuid })

export type VendorLoadListInput = z.infer<typeof vendorLoadListSchema>
export type VendorDocumentListInput = z.infer<typeof vendorDocumentListSchema>
