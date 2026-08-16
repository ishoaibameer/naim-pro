import { pgEnum } from "drizzle-orm/pg-core"

import {
  BILL_STATUS_VALUES,
  DEAL_STATUS_VALUES,
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
export const notificationTypeEnum = pgEnum(
  "notification_type",
  NOTIFICATION_TYPE_VALUES
)
