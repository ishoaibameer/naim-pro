import { describe, expect, it } from "vitest"

import { evaluateSettlementReadiness } from "./settlement"

const readyInput = {
  status: "SETTLEMENT_PENDING",
  finalWeightMt: "24.930",
  purchaseAmount: "99720.00",
  vendorBalance: "0.00",
  freightAmount: "18000.00",
  transporterBalance: "0.00",
  billId: "bill-id",
  companyReceivable: "0.00",
}

describe("settlement invariants", () => {
  it("is ready only when every financial obligation is complete", () => {
    expect(evaluateSettlementReadiness(readyInput)).toEqual({
      ready: true,
      blockers: [],
    })
  })

  it.each([
    ["vendorBalance", "12000.00", "Vendor balance"],
    ["transporterBalance", "8000.00", "Transporter balance"],
    ["billId", null, "Company bill not created"],
    ["companyReceivable", "35000.00", "Company receivable"],
  ] as const)("blocks on %s", (field, value, message) => {
    const result = evaluateSettlementReadiness({
      ...readyInput,
      [field]: value,
    })
    expect(result.ready).toBe(false)
    expect(result.blockers.some((blocker) => blocker.includes(message))).toBe(
      true
    )
  })

  it("requires delivered lifecycle and freight agreement", () => {
    const result = evaluateSettlementReadiness({
      ...readyInput,
      status: "IN_TRANSIT",
      freightAmount: null,
    })
    expect(result.blockers).toContain("Trip must be delivered")
    expect(result.blockers).toContain("Agreed freight amount is missing")
  })
})
