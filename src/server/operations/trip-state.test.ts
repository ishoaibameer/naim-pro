import { describe, expect, it } from "vitest"
import {
  assertTripTransition,
  canCancelTrip,
  canTransitionTrip,
  getTripPrimaryAction,
  TripTransitionError,
} from "./trip-state"

describe("Trip state machine", () => {
  it("allows the operational happy path", () => {
    expect(canTransitionTrip("CREATED", "TRUCK_ASSIGNED")).toBe(true)
    expect(canTransitionTrip("TRUCK_ASSIGNED", "LOADING")).toBe(true)
    expect(canTransitionTrip("LOADING", "LOADED")).toBe(true)
    expect(canTransitionTrip("LOADED", "IN_TRANSIT")).toBe(true)
    expect(canTransitionTrip("IN_TRANSIT", "DELIVERED")).toBe(true)
  })
  it("rejects skipped and reversed stages", () => {
    expect(() => assertTripTransition("TRUCK_ASSIGNED", "DELIVERED")).toThrow(
      TripTransitionError
    )
    expect(() => assertTripTransition("DELIVERED", "IN_TRANSIT")).toThrow(
      TripTransitionError
    )
  })
  it("keeps cancelled terminal and disallows in-transit cancellation", () => {
    expect(canCancelTrip("LOADED")).toBe(true)
    expect(canCancelTrip("IN_TRANSIT")).toBe(false)
    expect(canTransitionTrip("CANCELLED", "LOADING")).toBe(false)
  })
  it("derives the single primary action from status", () => {
    expect(getTripPrimaryAction("TRUCK_ASSIGNED")).toBe("START_LOADING")
    expect(getTripPrimaryAction("IN_TRANSIT")).toBe("CONFIRM_DELIVERY")
    expect(getTripPrimaryAction("CANCELLED")).toBeNull()
  })
})
