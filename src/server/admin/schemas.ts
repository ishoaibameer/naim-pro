import { z } from "zod"

export const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE"])

export const listQuerySchema = z.object({
  search: z.string().trim().max(80).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
})

export const entityIdSchema = z.object({ id: z.uuid() })

export const memberCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(64),
  password: z.string().min(10).max(1024),
  status: recordStatusSchema.default("ACTIVE"),
})

export const accountStatusSchema = z.object({
  userId: z.uuid(),
  status: recordStatusSchema,
  version: z.number().int().positive(),
})

export const passwordResetSchema = z.object({
  userId: z.uuid(),
  password: z.string().min(10).max(1024),
})

const optionalText = (max: number) => z.string().trim().max(max).default("")

export const vendorCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    contactPerson: optionalText(160),
    phone: optionalText(64),
    location: optionalText(180),
    notes: optionalText(4000),
    status: recordStatusSchema.default("ACTIVE"),
    loginEnabled: z.boolean().default(false),
    loginName: optionalText(160),
    loginPhone: optionalText(64),
    temporaryPassword: z.string().max(1024).default(""),
  })
  .superRefine((value, context) => {
    if (!value.loginEnabled) return
    for (const [field, label] of [
      ["loginName", "Login name"],
      ["loginPhone", "Login phone"],
      ["temporaryPassword", "Temporary password"],
    ] as const) {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${label} is required when login is enabled.`,
        })
      }
    }
    if (value.temporaryPassword && value.temporaryPassword.length < 10) {
      context.addIssue({
        code: "custom",
        path: ["temporaryPassword"],
        message: "Temporary password must contain at least 10 characters.",
      })
    }
  })

export const driverCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    phone: optionalText(64),
    transporterId: z.union([z.uuid(), z.literal("")]).default(""),
    status: recordStatusSchema.default("ACTIVE"),
    loginEnabled: z.boolean().default(false),
    loginName: optionalText(160),
    loginPhone: optionalText(64),
    temporaryPassword: z.string().max(1024).default(""),
  })
  .superRefine((value, context) => {
    if (!value.loginEnabled) return
    if (!value.loginName) {
      context.addIssue({
        code: "custom",
        path: ["loginName"],
        message: "Login name is required.",
      })
    }
    if (!value.loginPhone) {
      context.addIssue({
        code: "custom",
        path: ["loginPhone"],
        message: "Login phone is required.",
      })
    }
    if (value.temporaryPassword.length < 10) {
      context.addIssue({
        code: "custom",
        path: ["temporaryPassword"],
        message: "Temporary password must contain at least 10 characters.",
      })
    }
  })

export const partyStatusSchema = z.object({
  entity: z.enum([
    "VENDOR",
    "DRIVER",
    "TRANSPORTER",
    "VEHICLE",
    "COMPANY",
    "MATERIAL",
    "LOCATION",
  ]),
  id: z.uuid(),
  status: recordStatusSchema,
  version: z.number().int().positive(),
})

export const transporterSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(180),
  contactPerson: optionalText(160),
  phone: optionalText(64),
  location: optionalText(180),
  notes: optionalText(4000),
  status: recordStatusSchema.default("ACTIVE"),
  version: z.number().int().positive().optional(),
})

export const vehicleSchema = z.object({
  id: z.uuid().optional(),
  registrationNumber: z.string().trim().min(1).max(32),
  transporterId: z.union([z.uuid(), z.literal("")]).default(""),
  status: recordStatusSchema.default("ACTIVE"),
  version: z.number().int().positive().optional(),
})

export const companySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(180),
  contactPerson: optionalText(160),
  phone: optionalText(64),
  location: optionalText(180),
  address: optionalText(4000),
  status: recordStatusSchema.default("ACTIVE"),
  version: z.number().int().positive().optional(),
})

export const materialSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: optionalText(4000),
  status: recordStatusSchema.default("ACTIVE"),
  version: z.number().int().positive().optional(),
})

export const locationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(180),
  type: z.enum(["PICKUP", "DESTINATION", "OTHER"]).nullable().default(null),
  address: optionalText(4000),
  status: recordStatusSchema.default("ACTIVE"),
  version: z.number().int().positive().optional(),
})

export const activityQuerySchema = z.object({
  search: z.string().trim().max(80).default(""),
  action: z.string().trim().max(100).default(""),
  from: z.string().date().or(z.literal("")).default(""),
  to: z.string().date().or(z.literal("")).default(""),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(30),
})

export type ListQuery = z.infer<typeof listQuerySchema>
