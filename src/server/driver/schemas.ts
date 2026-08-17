import { z } from "zod"

import { DRIVER_EXPENSE_TYPE_VALUES } from "@/server/db/schema/constants"
import type { DRIVER_EXPENSE_STATUS_VALUES } from "@/server/db/schema/constants"
import { normalizeExactDecimal } from "@/server/operations/decimal"

const uuid = z.string().uuid()
const exactMoney = z.string().transform((value, context) => {
  try {
    return normalizeExactDecimal(value, {
      scale: 2,
      integerDigits: 14,
      positive: true,
    })
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message })
    return z.NEVER
  }
})

export const driverEntitySchema = z.object({ id: uuid })

export const driverTripListSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z
    .enum(["ALL", "DELIVERED", "SETTLEMENT_PENDING", "SETTLED", "ARCHIVED"])
    .catch("ALL"),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
})

export const driverTripMutationSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
})

export const driverCheckInSchema = driverTripMutationSchema.extend({
  type: z.enum(["REACHED_PICKUP", "REACHED_DESTINATION"]),
  note: z
    .string()
    .trim()
    .max(500)
    .default("")
    .transform((value) => value || null),
  locationText: z
    .string()
    .trim()
    .max(240)
    .default("")
    .transform((value) => value || null),
})

export const createDriverExpenseSchema = z.object({
  tripId: uuid,
  type: z.enum(DRIVER_EXPENSE_TYPE_VALUES),
  amount: exactMoney,
  expenseDate: z.string().date(),
  note: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .transform((value) => value || null),
})

export const attachDriverExpenseReceiptSchema = z.object({
  expenseId: uuid,
  documentId: uuid,
  version: z.number().int().positive(),
})

export const reviewDriverExpenseSchema = z.object({
  expenseId: uuid,
  version: z.number().int().positive(),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .transform((value) => value || null),
})

export type DriverTripListInput = z.infer<typeof driverTripListSchema>
export type DriverCheckInInput = z.infer<typeof driverCheckInSchema>
export type CreateDriverExpenseInput = z.infer<typeof createDriverExpenseSchema>
export type AttachDriverExpenseReceiptInput = z.infer<
  typeof attachDriverExpenseReceiptSchema
>
export type ReviewDriverExpenseInput = z.infer<typeof reviewDriverExpenseSchema>
export type DriverExpenseStatus = (typeof DRIVER_EXPENSE_STATUS_VALUES)[number]
