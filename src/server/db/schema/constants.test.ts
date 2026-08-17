import { describe, expect, it } from "vitest"

import {
  MONEY_PRECISION,
  MONEY_SCALE,
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
  RATE_PRECISION,
  RATE_SCALE,
  RECORD_STATUS_VALUES,
  ROLE_VALUES,
  TRIP_STATUS_VALUES,
  DRIVER_CHECK_IN_TYPE_VALUES,
  DRIVER_EXPENSE_STATUS_VALUES,
  DRIVER_EXPENSE_TYPE_VALUES,
  WEIGHT_PRECISION,
  WEIGHT_SCALE,
} from "./constants"
import * as schema from "./index"

describe("database domain constants", () => {
  it("keeps identity and trip status vocabularies explicit", () => {
    expect(ROLE_VALUES).toEqual(["ADMIN", "MEMBER", "VENDOR", "DRIVER"])
    expect(RECORD_STATUS_VALUES).toEqual(["ACTIVE", "INACTIVE"])
    expect(TRIP_STATUS_VALUES).toEqual([
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
    ])
  })

  it("keeps payment vocabularies aligned with the domain model", () => {
    expect(PAYMENT_DIRECTION_VALUES).toEqual(["OUTGOING", "INCOMING"])
    expect(PAYMENT_TYPE_VALUES).toEqual([
      "ADVANCE",
      "PARTIAL",
      "FINAL",
      "REFUND",
      "ADJUSTMENT",
    ])
    expect(PAYMENT_STATUS_VALUES).toEqual(["DRAFT", "POSTED", "REVERSED"])
  })

  it("uses exact PostgreSQL precision for weights, rates, and money", () => {
    expect([WEIGHT_PRECISION, WEIGHT_SCALE]).toEqual([12, 3])
    expect([RATE_PRECISION, RATE_SCALE]).toEqual([14, 2])
    expect([MONEY_PRECISION, MONEY_SCALE]).toEqual([16, 2])
  })

  it("keeps Driver operations vocabularies explicit", () => {
    expect(DRIVER_CHECK_IN_TYPE_VALUES).toEqual([
      "REACHED_PICKUP",
      "JOURNEY_STARTED",
      "REACHED_DESTINATION",
    ])
    expect(DRIVER_EXPENSE_TYPE_VALUES).toEqual([
      "DIESEL",
      "TOLL",
      "PARKING",
      "OTHER",
    ])
    expect(DRIVER_EXPENSE_STATUS_VALUES).toEqual([
      "PENDING",
      "APPROVED",
      "REJECTED",
    ])
    expect(schema.driverCheckIns).toBeDefined()
    expect(schema.driverExpenses).toBeDefined()
  })

  it("exports the initial relational schema through one barrel", () => {
    expect(schema.organizations).toBeDefined()
    expect(schema.deals).toBeDefined()
    expect(schema.trips).toBeDefined()
    expect(schema.payments).toBeDefined()
    expect(schema.auditEvents).toBeDefined()
  })
})
