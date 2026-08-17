import { describe, expect, it } from "vitest"

import { createPaymentSchema, reversePaymentSchema } from "./schemas"

const id = "123e4567-e89b-12d3-a456-426614174000"

describe("finance input contracts", () => {
  it("allows a Vendor advance before a Trip when allocated to a Deal", () => {
    const parsed = createPaymentSchema.parse({
      idempotencyKey: id,
      partyType: "VENDOR",
      partyId: id,
      direction: "OUTGOING",
      type: "ADVANCE",
      amount: "0.01",
      paymentDate: "2026-08-16",
      paymentMode: "UPI",
      receiptNumber: "",
      notes: "",
      paidByMembershipId: "",
      dealId: id,
      tripId: "",
      billId: "",
    })
    expect(parsed.amount).toBe("0.01")
    expect(parsed.tripId).toBeNull()
  })

  it("rejects counterparty direction mismatches and multiple targets", () => {
    const result = createPaymentSchema.safeParse({
      idempotencyKey: id,
      partyType: "COMPANY",
      partyId: id,
      direction: "OUTGOING",
      type: "PARTIAL",
      amount: "10",
      paymentDate: "2026-08-16",
      paymentMode: "CASH",
      receiptNumber: "",
      notes: "",
      paidByMembershipId: "",
      dealId: id,
      tripId: id,
      billId: "",
    })
    expect(result.success).toBe(false)
  })

  it("requires reversal reason and idempotency", () => {
    expect(
      reversePaymentSchema.safeParse({ id, version: 1, reason: "" }).success
    ).toBe(false)
  })
})
