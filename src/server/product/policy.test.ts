import { describe, expect, it } from "vitest"

import { isTripDelayed, reportRoleAllowed } from "./policy"

describe("product policies", () => {
  const now = new Date("2026-08-17T12:00:00.000Z")

  it("derives delay only after the configured in-transit threshold", () => {
    expect(
      isTripDelayed({
        status: "IN_TRANSIT",
        dispatchedAt: "2026-08-15T11:59:59.999Z",
        expectedTransitDurationHours: 48,
        now,
      })
    ).toBe(true)
    expect(
      isTripDelayed({
        status: "IN_TRANSIT",
        dispatchedAt: "2026-08-15T12:00:00.000Z",
        expectedTransitDurationHours: 48,
        now,
      })
    ).toBe(false)
  })

  it("never treats another lifecycle stage or an invalid dispatch time as delayed", () => {
    expect(
      isTripDelayed({
        status: "DELIVERED",
        dispatchedAt: "2026-08-01T00:00:00.000Z",
        expectedTransitDurationHours: 1,
        now,
      })
    ).toBe(false)
    expect(
      isTripDelayed({
        status: "IN_TRANSIT",
        dispatchedAt: "invalid",
        expectedTransitDurationHours: 1,
        now,
      })
    ).toBe(false)
  })

  it("limits internal reports to Admin and Member roles", () => {
    expect(reportRoleAllowed("ADMIN")).toBe(true)
    expect(reportRoleAllowed("MEMBER")).toBe(true)
    expect(reportRoleAllowed("VENDOR")).toBe(false)
    expect(reportRoleAllowed("DRIVER")).toBe(false)
  })
})
