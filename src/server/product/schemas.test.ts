import { describe, expect, it } from "vitest"

import { organizationSettingsSchema, reportFilterSchema } from "./schemas"

describe("product input schemas", () => {
  it("normalizes organization settings and enforces safe bounds", () => {
    expect(
      organizationSettingsSchema.parse({
        name: "  NAIM PRO  ",
        weightWarningThresholdPct: "1.5",
        expectedTransitDurationHours: "48",
        defaultPageSize: "20",
        version: 1,
      })
    ).toMatchObject({
      name: "NAIM PRO",
      weightWarningThresholdPct: "1.500",
      expectedTransitDurationHours: 48,
      defaultPageSize: 20,
    })
    expect(
      organizationSettingsSchema.safeParse({
        name: "NAIM PRO",
        weightWarningThresholdPct: "101",
        expectedTransitDurationHours: 0,
        defaultPageSize: 500,
        version: 1,
      }).success
    ).toBe(false)
  })

  it("accepts supported report filters and safely defaults invalid URL values", () => {
    expect(
      reportFilterSchema.parse({
        report: "WEIGHT",
        status: "DELIVERED",
        minDifferencePct: "2.25",
      })
    ).toMatchObject({
      report: "WEIGHT",
      status: "DELIVERED",
      minDifferencePct: 2.25,
    })
    expect(
      reportFilterSchema.parse({ report: "UNKNOWN", status: "UNKNOWN" })
    ).toMatchObject({ report: "TRIPS", status: "ALL" })
  })
})
