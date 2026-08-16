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
export const NOTIFICATION_TYPE_VALUES = [
  "INFO",
  "ACTION_REQUIRED",
  "WARNING",
] as const

export const WEIGHT_PRECISION = 12
export const WEIGHT_SCALE = 3
export const RATE_PRECISION = 14
export const RATE_SCALE = 2
export const MONEY_PRECISION = 16
export const MONEY_SCALE = 2
export const PERCENTAGE_PRECISION = 9
export const PERCENTAGE_SCALE = 4
