export const ROLE_VALUES = ["ADMIN", "MEMBER", "VENDOR", "DRIVER"] as const
export const RECORD_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const
export const DEAL_STATUS_VALUES = [
  "DRAFT",
  "ACTIVE",
  "FULFILLED",
  "CANCELLED",
  "ARCHIVED",
] as const
export const TRIP_STATUS_VALUES = [
  "CREATED",
  "TRUCK_ASSIGNED",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "DELIVERED",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "ARCHIVED",
  "CANCELLED",
] as const
export const PAYMENT_DIRECTION_VALUES = ["OUTGOING", "INCOMING"] as const
export const PAYMENT_TYPE_VALUES = [
  "ADVANCE",
  "PARTIAL",
  "FINAL",
  "REFUND",
  "ADJUSTMENT",
] as const
export const PAYMENT_STATUS_VALUES = ["DRAFT", "POSTED", "REVERSED"] as const
export const PAYMENT_MODE_VALUES = [
  "CASH",
  "BANK_TRANSFER",
  "CHEQUE",
  "UPI",
  "OTHER",
] as const
export const BILL_STATUS_VALUES = ["DRAFT", "ISSUED", "VOID"] as const
export const DOCUMENT_TYPE_VALUES = [
  "VEHICLE_PHOTO",
  "LOADING_PHOTO",
  "WEIGHBRIDGE_SLIP",
  "PAYMENT_RECEIPT",
  "DELIVERY_CHALLAN",
  "BILL",
  "PERMIT",
  "OTHER",
] as const
export const CUSTOM_FIELD_TARGET_VALUES = [
  "DEAL",
  "TRIP_LOADING",
  "TRIP_DELIVERY",
  "VENDOR",
  "DRIVER",
  "PAYMENT",
] as const
export const CUSTOM_FIELD_TYPE_VALUES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "CURRENCY",
  "QUANTITY_TON",
  "PERCENTAGE",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "IMAGE",
  "DOCUMENT",
] as const
export const NOTIFICATION_TYPE_VALUES = [
  "INFO",
  "ACTION_REQUIRED",
  "WARNING",
] as const
export const DRIVER_CHECK_IN_TYPE_VALUES = [
  "REACHED_PICKUP",
  "JOURNEY_STARTED",
  "REACHED_DESTINATION",
] as const
export const DRIVER_EXPENSE_TYPE_VALUES = [
  "DIESEL",
  "TOLL",
  "PARKING",
  "OTHER",
] as const
export const DRIVER_EXPENSE_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const

export const WEIGHT_PRECISION = 12
export const WEIGHT_SCALE = 3
export const RATE_PRECISION = 14
export const RATE_SCALE = 2
export const MONEY_PRECISION = 16
export const MONEY_SCALE = 2
export const PERCENTAGE_PRECISION = 9
export const PERCENTAGE_SCALE = 4
