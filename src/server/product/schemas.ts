import { z } from "zod"

import {
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_TYPE_VALUES,
  TRIP_STATUS_VALUES,
} from "@/server/db/schema/constants"
import { normalizeExactDecimal } from "@/server/operations/decimal"

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  weightWarningThresholdPct: z.string().transform((value, context) => {
    try {
      const normalized = normalizeExactDecimal(value, {
        scale: 3,
        integerDigits: 3,
        positive: true,
      })
      if (Number(normalized) > 100)
        throw new Error("Threshold cannot exceed 100%.")
      return normalized
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message })
      return z.NEVER
    }
  }),
  expectedTransitDurationHours: z.coerce.number().int().min(1).max(720),
  defaultPageSize: z.coerce.number().int().min(10).max(100),
  version: z.number().int().positive(),
})

export const REPORT_TYPE_VALUES = [
  "TRIPS",
  "VENDORS",
  "TRANSPORTERS",
  "COMPANIES",
  "PAYMENTS",
  "WEIGHT",
] as const

const optionalId = z.string().uuid().optional().catch(undefined)
const optionalDate = z.string().date().optional().catch(undefined)

export const reportFilterSchema = z.object({
  report: z.enum(REPORT_TYPE_VALUES).catch("TRIPS"),
  from: optionalDate,
  to: optionalDate,
  status: z.enum(["ALL", ...TRIP_STATUS_VALUES]).catch("ALL"),
  vendorId: optionalId,
  vehicleId: optionalId,
  driverId: optionalId,
  transporterId: optionalId,
  companyId: optionalId,
  pickupId: optionalId,
  destinationId: optionalId,
  partyType: z.enum(["ALL", "VENDOR", "TRANSPORTER", "COMPANY"]).catch("ALL"),
  partyId: optionalId,
  direction: z.enum(["ALL", ...PAYMENT_DIRECTION_VALUES]).catch("ALL"),
  paymentType: z.enum(["ALL", ...PAYMENT_TYPE_VALUES]).catch("ALL"),
  memberId: optionalId,
  minDifferencePct: z.coerce.number().min(0).max(100).catch(0),
})

export const globalSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
})

export const notificationListSchema = z.object({
  tab: z.enum(["UNREAD", "READ"]).catch("UNREAD"),
})

export const notificationMutationSchema = z.object({
  id: z.string().uuid(),
})

export type OrganizationSettingsInput = z.infer<
  typeof organizationSettingsSchema
>
export type ReportFilterInput = z.infer<typeof reportFilterSchema>
