import { pgEnum } from "drizzle-orm/pg-core"

import {
  BILL_STATUS_VALUES,
  CUSTOM_FIELD_TARGET_VALUES,
  CUSTOM_FIELD_TYPE_VALUES,
  DEAL_STATUS_VALUES,
  DRIVER_CHECK_IN_TYPE_VALUES,
  DRIVER_EXPENSE_STATUS_VALUES,
  DRIVER_EXPENSE_TYPE_VALUES,
  DOCUMENT_TYPE_VALUES,
  NOTIFICATION_TYPE_VALUES,
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_MODE_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
  RECORD_STATUS_VALUES,
  ROLE_VALUES,
  TRIP_STATUS_VALUES,
} from "./constants"

export const roleEnum = pgEnum("role", ROLE_VALUES)
export const recordStatusEnum = pgEnum("record_status", RECORD_STATUS_VALUES)
export const dealStatusEnum = pgEnum("deal_status", DEAL_STATUS_VALUES)
export const tripStatusEnum = pgEnum("trip_status", TRIP_STATUS_VALUES)
export const paymentDirectionEnum = pgEnum(
  "payment_direction",
  PAYMENT_DIRECTION_VALUES
)
export const paymentTypeEnum = pgEnum("payment_type", PAYMENT_TYPE_VALUES)
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUS_VALUES)
export const paymentModeEnum = pgEnum("payment_mode", PAYMENT_MODE_VALUES)
export const billStatusEnum = pgEnum("bill_status", BILL_STATUS_VALUES)
export const documentTypeEnum = pgEnum("document_type", DOCUMENT_TYPE_VALUES)
export const customFieldTargetEnum = pgEnum(
  "custom_field_target",
  CUSTOM_FIELD_TARGET_VALUES
)
export const customFieldTypeEnum = pgEnum(
  "custom_field_type",
  CUSTOM_FIELD_TYPE_VALUES
)
export const notificationTypeEnum = pgEnum(
  "notification_type",
  NOTIFICATION_TYPE_VALUES
)
export const driverCheckInTypeEnum = pgEnum(
  "driver_check_in_type",
  DRIVER_CHECK_IN_TYPE_VALUES
)
export const driverExpenseTypeEnum = pgEnum(
  "driver_expense_type",
  DRIVER_EXPENSE_TYPE_VALUES
)
export const driverExpenseStatusEnum = pgEnum(
  "driver_expense_status",
  DRIVER_EXPENSE_STATUS_VALUES
)
