import { z } from "zod"

import { DEAL_STATUS_VALUES, TRIP_STATUS_VALUES } from "@/server/db/schema"
import { normalizeExactDecimal } from "./decimal"

const uuid = z.string().uuid()
const exactRate = z.string().transform((value, context) => {
  try {
    return normalizeExactDecimal(value, { scale: 2, integerDigits: 12 })
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message })
    return z.NEVER
  }
})
const exactWeight = z.string().transform((value, context) => {
  try {
    return normalizeExactDecimal(value, {
      scale: 3,
      integerDigits: 9,
      positive: true,
    })
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message })
    return z.NEVER
  }
})

export const pageSchema = z.coerce.number().int().min(1).catch(1)
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(20)

export const dealListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum([...DEAL_STATUS_VALUES, "ALL"]).catch("ACTIVE"),
  vendorId: uuid.optional().catch(undefined),
  ownerMembershipId: uuid.optional().catch(undefined),
  materialId: uuid.optional().catch(undefined),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: pageSchema,
  pageSize: pageSizeSchema,
})

export const createDealSchema = z.object({
  vendorId: uuid,
  pickupLocationId: uuid,
  materialId: uuid,
  purchaseRate: exactRate,
  expectedQuantityMt: z
    .union([exactWeight, z.literal("")])
    .transform((v) => v || null),
  ownerMembershipId: uuid.optional().catch(undefined),
  notes: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .transform((v) => v || null),
})

export const reassignDealOwnerSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  ownerMembershipId: uuid,
})

const optionalInlineText = (max: number) =>
  z.string().trim().max(max).default("")

export const createInlineVendorSchema = z.object({
  name: z.string().trim().min(1).max(180),
  contactPerson: optionalInlineText(160),
  phone: optionalInlineText(64),
  location: optionalInlineText(180),
  notes: optionalInlineText(4000),
})

export const createInlineLocationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: z.enum(["PICKUP", "DESTINATION", "OTHER"]),
  address: optionalInlineText(4000),
})

export const createInlineMaterialSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalInlineText(4000),
})

export const tripListSchema = z.object({
  tab: z.enum(["ACTIVE", "COMPLETED", "ARCHIVE"]).catch("ACTIVE"),
  search: z.string().trim().max(100).catch(""),
  status: z.enum([...TRIP_STATUS_VALUES, "ALL"]).catch("ALL"),
  vendorId: uuid.optional().catch(undefined),
  vehicleId: uuid.optional().catch(undefined),
  driverId: uuid.optional().catch(undefined),
  pickupLocationId: uuid.optional().catch(undefined),
  destinationLocationId: uuid.optional().catch(undefined),
  transporterId: uuid.optional().catch(undefined),
  companyId: uuid.optional().catch(undefined),
  ownerMembershipId: uuid.optional().catch(undefined),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: pageSchema,
  pageSize: pageSizeSchema,
})

export const createTripSchema = z.object({
  dealId: uuid,
  transporterId: uuid,
  vehicleId: uuid,
  driverId: uuid,
  destinationCompanyId: uuid,
  destinationLocationId: uuid,
})

export const tripMutationSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
})

export const operationalActivityQuerySchema = z.object({
  actor: z.string().trim().max(80).catch(""),
  type: z.string().trim().max(100).catch(""),
  entity: z.string().trim().max(80).catch(""),
  from: z.string().date().or(z.literal("")).catch(""),
  to: z.string().date().or(z.literal("")).catch(""),
})
export const confirmLoadingSchema = tripMutationSchema.extend({
  loadedWeightMt: exactWeight,
  challanNumber: z
    .string()
    .trim()
    .max(80)
    .default("")
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .transform((v) => v || null),
})
export const confirmDeliverySchema = tripMutationSchema.extend({
  challanNumber: z.string().trim().min(1).max(80),
  finalWeightMt: exactWeight,
  weighmentCardNumber: z.string().trim().min(1).max(80),
})
export const cancelTripSchema = tripMutationSchema.extend({
  reason: z.string().trim().min(3).max(1000),
})
export const entityIdSchema = z.object({ id: uuid })
