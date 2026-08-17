import { describe, expect, it } from "vitest"

import { formatInr, formatPercent, formatWeight, initials } from "./format"

describe("display formatters", () => {
  it("uses exact user-facing money and weight precision", () => {
    expect(formatInr("125000")).toContain("1,25,000.00")
    expect(formatWeight("24.35")).toBe("24.350 t")
    expect(formatPercent("1.5")).toBe("1.50%")
  })

  it("returns safe fallbacks for invalid values and stable initials", () => {
    expect(formatInr("invalid")).toBe("—")
    expect(formatWeight("invalid")).toBe("—")
    expect(initials("Naim Pro Admin")).toBe("NP")
    expect(initials("   ")).toBe("?")
  })
})
