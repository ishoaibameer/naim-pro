import { describe, expect, it } from "vitest"
import { calculateWeightReconciliation, normalizeExactDecimal } from "./decimal"

describe("exact operational decimals", () => {
  it("normalizes rate and weight without floating point", () => {
    expect(
      normalizeExactDecimal("1250.5", { scale: 2, integerDigits: 12 })
    ).toBe("1250.50")
    expect(
      normalizeExactDecimal("25.32", {
        scale: 3,
        integerDigits: 9,
        positive: true,
      })
    ).toBe("25.320")
  })
  it("rejects negative, excessive precision, and non-positive loading weights", () => {
    expect(() =>
      normalizeExactDecimal("-1", { scale: 3, integerDigits: 9 })
    ).toThrow()
    expect(() =>
      normalizeExactDecimal("1.0001", { scale: 3, integerDigits: 9 })
    ).toThrow()
    expect(() =>
      normalizeExactDecimal("0", { scale: 3, integerDigits: 9, positive: true })
    ).toThrow()
  })
  it("calculates exact difference, rounded percentage, and threshold flag", () => {
    expect(calculateWeightReconciliation("25.320", "24.930")).toEqual({
      loadedWeightMt: "25.320",
      finalWeightMt: "24.930",
      differenceMt: "0.390",
      differencePercent: "1.5403",
      hasWeightIssue: true,
    })
  })
  it("is safe when loaded weight is zero", () => {
    expect(calculateWeightReconciliation("0", "0").differencePercent).toBe(
      "0.0000"
    )
  })
  it("uses absolute percentage for overage attention", () => {
    expect(calculateWeightReconciliation("10", "10.200").hasWeightIssue).toBe(
      true
    )
  })
})
