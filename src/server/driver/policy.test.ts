import { describe, expect, it } from "vitest"

import {
  canDriverCheckIn,
  canDriverStartJourney,
  canReviewDriverExpense,
} from "./policy"

describe("Driver operational policy", () => {
  it("starts a journey only for the current assigned Driver on a Loaded Trip with an active vehicle", () => {
    const valid = {
      status: "LOADED",
      currentDriverId: "driver-a",
      driverId: "driver-a",
      hasOpenAssignment: true,
      vehicleActive: true,
    }
    expect(canDriverStartJourney(valid)).toBe(true)
    expect(canDriverStartJourney({ ...valid, status: "LOADING" })).toBe(false)
    expect(
      canDriverStartJourney({ ...valid, currentDriverId: "driver-b" })
    ).toBe(false)
    expect(canDriverStartJourney({ ...valid, hasOpenAssignment: false })).toBe(
      false
    )
    expect(canDriverStartJourney({ ...valid, vehicleActive: false })).toBe(
      false
    )
  })

  it("keeps arrival check-ins separate from unsupported Trip states", () => {
    expect(canDriverCheckIn("TRUCK_ASSIGNED", "REACHED_PICKUP")).toBe(true)
    expect(canDriverCheckIn("IN_TRANSIT", "REACHED_DESTINATION")).toBe(true)
    expect(canDriverCheckIn("LOADED", "REACHED_DESTINATION")).toBe(false)
  })

  it("prevents Drivers from approving their own expenses", () => {
    expect(canReviewDriverExpense("DRIVER")).toBe(false)
    expect(canReviewDriverExpense("VENDOR")).toBe(false)
    expect(canReviewDriverExpense("MEMBER")).toBe(true)
    expect(canReviewDriverExpense("ADMIN")).toBe(true)
  })
})
