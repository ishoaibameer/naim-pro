import { describe, expect, it } from "vitest"

import type { AwaitedReport } from "./types"
import { reportToCsv } from "./report-csv"

describe("report CSV", () => {
  it("exports only the declared report columns and escapes spreadsheet cells", () => {
    const report = {
      type: "TRIPS",
      rows: [
        {
          tripNumber: "TRIP-1",
          vehicle: "KA-01, Truck",
          vendor: 'Vendor "North"',
          company: "Company\nOne",
          loadedWeightMt: "24.500",
          finalWeightMt: "24.000",
          differenceMt: "0.500",
          status: "DELIVERED",
          dispatchedAt: "2026-08-16",
          deliveredAt: "2026-08-17",
          hiddenMargin: "must-not-export",
        },
      ],
    } as unknown as AwaitedReport
    const csv = reportToCsv(report)
    expect(csv).toContain('"KA-01, Truck"')
    expect(csv).toContain('"Vendor ""North"""')
    expect(csv).toContain('"Company\nOne"')
    expect(csv).not.toContain("hiddenMargin")
    expect(csv).not.toContain("must-not-export")
  })
})
