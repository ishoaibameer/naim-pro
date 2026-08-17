import { describe, expect, it } from "vitest"

import {
  calculateMaterialValue,
  normalizeMoney,
  signedPaymentAmount,
  subtractMoney,
  sumMoney,
} from "./money"

describe("exact INR arithmetic", () => {
  it("preserves one paisa and large values", () => {
    expect(normalizeMoney("0.01", true)).toBe("0.01")
    expect(normalizeMoney("99999999999999.99", true)).toBe("99999999999999.99")
  })

  it("calculates material value without float drift", () => {
    expect(calculateMaterialValue("24.930", "4000.00")).toBe("99720.00")
    expect(calculateMaterialValue("0.001", "0.01")).toBe("0.00")
  })

  it("handles partial and multiple payments exactly", () => {
    const paid = sumMoney(["10000.01", "2500.02", "0.01"])
    expect(paid).toBe("12500.04")
    expect(subtractMoney("18000.00", paid)).toBe("5499.96")
  })

  it("nets reversal directions", () => {
    const original = signedPaymentAmount("100.00", "OUTGOING", "OUTGOING")
    const reversal = signedPaymentAmount("100.00", "INCOMING", "OUTGOING")
    expect(original + reversal).toBe(0n)
  })
})
