import { z } from "zod"

import { normalizePhone } from "@/server/auth/phone"
import type { CustomFieldType, CustomFieldValidationConfig } from "./config"

export interface ValueDefinition {
  fieldType: CustomFieldType
  required: boolean
  validation: CustomFieldValidationConfig
  options: readonly { code: string; status: "ACTIVE" | "INACTIVE" }[]
}

export function isEmptyCustomFieldValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function validateCustomFieldValue(
  definition: ValueDefinition,
  value: unknown
): unknown {
  if (isEmptyCustomFieldValue(value)) {
    if (definition.required) throw new Error("This field is required.")
    return null
  }
  const { fieldType, validation } = definition
  if (fieldType === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error("Enter a Yes or No value.")
    return value
  }
  if (
    ["NUMBER", "CURRENCY", "QUANTITY_TON", "PERCENTAGE"].includes(fieldType)
  ) {
    const parsed = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.")
    const minimum =
      validation.min ??
      (fieldType === "PERCENTAGE" ? 0 : fieldType === "NUMBER" ? undefined : 0)
    const maximum =
      validation.max ?? (fieldType === "PERCENTAGE" ? 100 : undefined)
    if (minimum !== undefined && parsed < minimum)
      throw new Error(`Value must be at least ${minimum}.`)
    if (maximum !== undefined && parsed > maximum)
      throw new Error(`Value must be at most ${maximum}.`)
    return parsed
  }
  if (fieldType === "MULTI_SELECT") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
      throw new Error("Choose valid options.")
    const allowed = new Set(
      definition.options
        .filter((option) => option.status === "ACTIVE")
        .map((option) => option.code)
    )
    const unique = [...new Set(value)]
    if (unique.some((item) => !allowed.has(item)))
      throw new Error("Choose valid options.")
    return unique
  }
  if (fieldType === "SELECT") {
    if (
      typeof value !== "string" ||
      !definition.options.some(
        (option) => option.status === "ACTIVE" && option.code === value
      )
    )
      throw new Error("Choose a valid option.")
    return value
  }
  if (fieldType === "PHONE") {
    if (typeof value !== "string")
      throw new Error("Enter a valid phone number.")
    return normalizePhone(value)
  }
  if (fieldType === "DATE") {
    return z.string().date().parse(value)
  }
  if (fieldType === "DATETIME") {
    const parsed = z.string().datetime({ offset: true }).safeParse(value)
    if (!parsed.success) throw new Error("Enter a valid date and time.")
    return parsed.data
  }
  if (fieldType === "IMAGE" || fieldType === "DOCUMENT") {
    return z.string().uuid("Choose an uploaded document.").parse(value)
  }
  if (typeof value !== "string") throw new Error("Enter a text value.")
  const normalized = value.trim()
  const maximum = validation.maxLength ?? (fieldType === "TEXT" ? 500 : 5000)
  if (normalized.length > maximum)
    throw new Error(`Use ${maximum} characters or fewer.`)
  return normalized
}
