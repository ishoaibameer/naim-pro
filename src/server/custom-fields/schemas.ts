import { z } from "zod"

import { DOCUMENT_TYPE_VALUES, ROLE_VALUES } from "@/server/db/schema/constants"
import {
  CUSTOM_FIELD_TARGET_VALUES,
  CUSTOM_FIELD_TYPE_VALUES,
  TARGET_SECTIONS,
} from "./config"

const uuid = z.string().uuid()
const roleSchema = z.enum(ROLE_VALUES)

export const customFieldTargetSchema = z.enum(CUSTOM_FIELD_TARGET_VALUES)

export const customFieldRecordSchema = z.object({
  target: customFieldTargetSchema,
  recordId: uuid,
})

const optionSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  label: z.string().trim().min(1).max(160),
})

export const saveCustomFieldDefinitionSchema = z
  .object({
    id: uuid.optional(),
    version: z.number().int().positive().optional(),
    target: customFieldTargetSchema,
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,63}$/),
    label: z.string().trim().min(1).max(160),
    fieldType: z.enum(CUSTOM_FIELD_TYPE_VALUES),
    sectionKey: z.string().trim().min(1).max(64),
    required: z.boolean(),
    requiredRoles: z.array(roleSchema).max(4),
    visibleRoles: z.array(roleSchema).min(1).max(4),
    editableRoles: z.array(roleSchema).min(1).max(4),
    sortOrder: z.number().int().min(0).max(10000),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().min(1).max(10000).optional(),
    allowedDocumentTypes: z.array(z.enum(DOCUMENT_TYPE_VALUES)).max(8),
    options: z.array(optionSchema).max(100),
  })
  .superRefine((value, context) => {
    if (
      !TARGET_SECTIONS[value.target].some(
        (section) => section.key === value.sectionKey
      )
    )
      context.addIssue({
        code: "custom",
        path: ["sectionKey"],
        message: "Choose a valid section for this form.",
      })
    if (
      value.min !== undefined &&
      value.max !== undefined &&
      value.min > value.max
    )
      context.addIssue({
        code: "custom",
        path: ["max"],
        message: "Maximum must be greater than or equal to minimum.",
      })
    const optionType =
      value.fieldType === "SELECT" || value.fieldType === "MULTI_SELECT"
    if (optionType && value.options.length < 1)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Select fields require at least one option.",
      })
    if (!optionType && value.options.length)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Options are only valid for select fields.",
      })
    if (
      value.required &&
      (value.fieldType === "IMAGE" || value.fieldType === "DOCUMENT") &&
      !["TRIP_LOADING", "TRIP_DELIVERY"].includes(value.target)
    )
      context.addIssue({
        code: "custom",
        path: ["required"],
        message:
          "Document fields cannot be required until the parent record exists.",
      })
    if (value.requiredRoles.some((role) => !value.editableRoles.includes(role)))
      context.addIssue({
        code: "custom",
        path: ["requiredRoles"],
        message: "A required role must also be able to edit the field.",
      })
    if (value.editableRoles.some((role) => !value.visibleRoles.includes(role)))
      context.addIssue({
        code: "custom",
        path: ["editableRoles"],
        message: "An editable role must also be able to see the field.",
      })
  })

export const customFieldStatusSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().min(3).max(1000),
})

export const reorderCustomFieldsSchema = z.object({
  target: customFieldTargetSchema,
  orderedIds: z.array(uuid).max(200),
})

export const saveCustomFieldValuesSchema = z.object({
  target: customFieldTargetSchema,
  recordId: uuid,
  values: z
    .array(z.object({ definitionId: uuid, value: z.unknown() }))
    .max(200),
})

export const validateCustomFieldCreateValuesSchema = z.object({
  target: customFieldTargetSchema,
  values: saveCustomFieldValuesSchema.shape.values,
})

export type SaveCustomFieldDefinitionInput = z.infer<
  typeof saveCustomFieldDefinitionSchema
>
export type SaveCustomFieldValuesInput = z.infer<
  typeof saveCustomFieldValuesSchema
>
