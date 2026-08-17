import type { ROLE_VALUES } from "@/server/db/schema/constants"
import {
  CUSTOM_FIELD_TARGET_VALUES,
  CUSTOM_FIELD_TYPE_VALUES,
} from "@/server/db/schema/constants"

export { CUSTOM_FIELD_TARGET_VALUES, CUSTOM_FIELD_TYPE_VALUES }

export type CustomFieldTarget = (typeof CUSTOM_FIELD_TARGET_VALUES)[number]
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE_VALUES)[number]
export type CustomFieldRole = (typeof ROLE_VALUES)[number]

export const CUSTOM_FIELD_TARGET_LABELS: Record<CustomFieldTarget, string> = {
  DEAL: "Deal",
  TRIP_LOADING: "Trip Loading",
  TRIP_DELIVERY: "Trip Delivery",
  VENDOR: "Vendor",
  DRIVER: "Driver",
  PAYMENT: "Payment",
}

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  TEXTAREA: "Long Text",
  NUMBER: "Number",
  CURRENCY: "Currency (INR)",
  QUANTITY_TON: "Quantity (Metric Ton)",
  PERCENTAGE: "Percentage",
  DATE: "Date",
  DATETIME: "Date and Time",
  BOOLEAN: "Yes / No",
  SELECT: "Select",
  MULTI_SELECT: "Multi Select",
  PHONE: "Indian Phone",
  IMAGE: "Image",
  DOCUMENT: "Document",
}

export interface CoreFieldDefinition {
  key: string
  label: string
  required: boolean
  section: string
}

export const TARGET_SECTIONS: Record<
  CustomFieldTarget,
  readonly { key: string; label: string }[]
> = {
  DEAL: [
    { key: "COMMERCIAL", label: "Commercial" },
    { key: "QUALITY", label: "Quality" },
    { key: "DOCUMENTS", label: "Documents" },
    { key: "OTHER", label: "Other" },
  ],
  TRIP_LOADING: [
    { key: "ASSIGNMENT", label: "Vehicle / Assignment" },
    { key: "LOADING", label: "Loading" },
    { key: "QUALITY", label: "Quality" },
    { key: "DOCUMENTS", label: "Documents" },
    { key: "OTHER", label: "Other" },
  ],
  TRIP_DELIVERY: [
    { key: "DELIVERY", label: "Delivery" },
    { key: "QUALITY", label: "Quality" },
    { key: "DOCUMENTS", label: "Documents" },
    { key: "OTHER", label: "Other" },
  ],
  VENDOR: [
    { key: "BUSINESS", label: "Business" },
    { key: "COMPLIANCE", label: "Compliance" },
    { key: "INTERNAL", label: "Internal" },
    { key: "OTHER", label: "Other" },
  ],
  DRIVER: [
    { key: "IDENTITY", label: "Identity" },
    { key: "LICENCE", label: "Licence" },
    { key: "EMERGENCY", label: "Emergency" },
    { key: "OTHER", label: "Other" },
  ],
  PAYMENT: [
    { key: "REFERENCE", label: "References" },
    { key: "APPROVAL", label: "Approval" },
    { key: "DOCUMENTS", label: "Documents" },
    { key: "OTHER", label: "Other" },
  ],
}

export const PROTECTED_CORE_FIELDS: Record<
  CustomFieldTarget,
  readonly CoreFieldDefinition[]
> = {
  DEAL: [
    { key: "vendor", label: "Vendor", required: true, section: "Commercial" },
    {
      key: "material",
      label: "Material",
      required: true,
      section: "Commercial",
    },
    {
      key: "purchase_rate",
      label: "Purchase Rate",
      required: true,
      section: "Commercial",
    },
    {
      key: "pickup_location",
      label: "Pickup Location",
      required: true,
      section: "Commercial",
    },
  ],
  TRIP_LOADING: [
    {
      key: "vehicle",
      label: "Vehicle",
      required: true,
      section: "Vehicle / Assignment",
    },
    {
      key: "driver",
      label: "Driver",
      required: false,
      section: "Vehicle / Assignment",
    },
    {
      key: "loaded_weight_mt",
      label: "Loaded Weight",
      required: true,
      section: "Loading",
    },
  ],
  TRIP_DELIVERY: [
    {
      key: "delivery_challan_number",
      label: "Delivery Challan Number",
      required: true,
      section: "Delivery",
    },
    { key: "vehicle", label: "Vehicle", required: true, section: "Delivery" },
    {
      key: "final_weight_mt",
      label: "Final Weight",
      required: true,
      section: "Delivery",
    },
    {
      key: "weighment_card_number",
      label: "Weighment Card Number",
      required: true,
      section: "Delivery",
    },
  ],
  VENDOR: [
    { key: "name", label: "Vendor Name", required: true, section: "Business" },
    { key: "phone", label: "Phone", required: false, section: "Business" },
    {
      key: "login",
      label: "Vendor Login",
      required: false,
      section: "Business",
    },
  ],
  DRIVER: [
    { key: "name", label: "Driver Name", required: true, section: "Identity" },
    { key: "phone", label: "Phone", required: false, section: "Identity" },
    {
      key: "login",
      label: "Driver Login",
      required: false,
      section: "Identity",
    },
  ],
  PAYMENT: [
    { key: "amount", label: "Amount", required: true, section: "Payment" },
    { key: "date", label: "Payment Date", required: true, section: "Payment" },
    { key: "party", label: "Party", required: true, section: "Payment" },
    {
      key: "direction",
      label: "Direction",
      required: true,
      section: "Payment",
    },
  ],
}

export interface CustomFieldValidationConfig {
  min?: number
  max?: number
  maxLength?: number
  allowedDocumentTypes?: string[]
  condition?: {
    fieldKey: string
    equals: string | boolean
  }
}

export function slugifyFieldKey(label: string): string {
  return label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
}
