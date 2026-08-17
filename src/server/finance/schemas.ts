import { z } from "zod"

import {
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_MODE_VALUES,
  PAYMENT_TYPE_VALUES,
} from "@/server/db/schema"
import { normalizeMoney } from "./money"

const uuid = z.string().uuid()
const optionalUuid = z
  .union([uuid, z.literal("")])
  .transform((value) => value || null)
const money = z.string().transform((value, context) => {
  try {
    return normalizeMoney(value, true)
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message })
    return z.NEVER
  }
})

export const paymentListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  direction: z.enum([...PAYMENT_DIRECTION_VALUES, "ALL"]).catch("ALL"),
  partyType: z.enum(["VENDOR", "TRANSPORTER", "COMPANY", "ALL"]).catch("ALL"),
  type: z.enum([...PAYMENT_TYPE_VALUES, "ALL"]).catch("ALL"),
  recordedByMembershipId: uuid.optional().catch(undefined),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
})

export const createPaymentSchema = z
  .object({
    idempotencyKey: uuid,
    partyType: z.enum(["VENDOR", "TRANSPORTER", "COMPANY"]),
    partyId: uuid,
    direction: z.enum(PAYMENT_DIRECTION_VALUES),
    type: z.enum(PAYMENT_TYPE_VALUES),
    amount: money,
    paymentDate: z.string().date(),
    paymentMode: z.enum(PAYMENT_MODE_VALUES),
    receiptNumber: z
      .string()
      .trim()
      .max(100)
      .default("")
      .transform((v) => v || null),
    notes: z
      .string()
      .trim()
      .max(2000)
      .default("")
      .transform((v) => v || null),
    paidByMembershipId: optionalUuid,
    dealId: optionalUuid,
    tripId: optionalUuid,
    billId: optionalUuid,
  })
  .superRefine((input, context) => {
    const targetCount = [input.dealId, input.tripId, input.billId].filter(
      Boolean
    ).length
    if (targetCount > 1)
      context.addIssue({
        code: "custom",
        message: "Choose at most one allocation target.",
      })
    if (input.partyType === "VENDOR" && input.direction !== "OUTGOING")
      context.addIssue({
        code: "custom",
        path: ["direction"],
        message: "Vendor payments must be outgoing.",
      })
    if (input.partyType === "TRANSPORTER" && input.direction !== "OUTGOING")
      context.addIssue({
        code: "custom",
        path: ["direction"],
        message: "Transporter payments must be outgoing.",
      })
    if (input.partyType === "COMPANY" && input.direction !== "INCOMING")
      context.addIssue({
        code: "custom",
        path: ["direction"],
        message: "Company receipts must be incoming.",
      })
  })

export const reversePaymentSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  idempotencyKey: uuid,
  reason: z.string().trim().min(3).max(1000),
})

export const billCreateSchema = z.object({
  idempotencyKey: uuid,
  companyId: uuid,
  billNumber: z.string().trim().min(1).max(64),
  billDate: z.string().date(),
  tripId: uuid,
  billedAmount: money,
  notes: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .transform((v) => v || null),
})

export const setFreightSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  amount: money,
})

export const tripFinanceMutationSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
})

export const billMutationSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
})

export const voidBillSchema = billMutationSchema.extend({
  reason: z.string().trim().min(3).max(1000),
})

export const closeDealSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
})

export const financeEntityIdSchema = z.object({ id: uuid })

export const paymentCreateSearchSchema = z.object({
  partyType: z
    .enum(["VENDOR", "TRANSPORTER", "COMPANY"])
    .optional()
    .catch(undefined),
  partyId: uuid.optional().catch(undefined),
  dealId: uuid.optional().catch(undefined),
  tripId: uuid.optional().catch(undefined),
  billId: uuid.optional().catch(undefined),
})

export const billCreateSearchSchema = z.object({
  tripId: uuid.optional().catch(undefined),
})

export const archiveListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  vendorId: uuid.optional().catch(undefined),
  companyId: uuid.optional().catch(undefined),
  vehicleId: uuid.optional().catch(undefined),
  ownerMembershipId: uuid.optional().catch(undefined),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
})
