import { describe, expect, it } from "vitest"
import { confirmDeliverySchema, createDealSchema } from "./schemas"

const id = "123e4567-e89b-12d3-a456-426614174000"
describe("operational input contracts", () => {
  it("accepts a valid exact Deal and normalizes values", () => {
    const result = createDealSchema.parse({
      vendorId: id,
      pickupLocationId: id,
      materialId: id,
      purchaseRate: "1200.5",
      expectedQuantityMt: "25.32",
      ownerMembershipId: id,
      notes: "",
    })
    expect(result.purchaseRate).toBe("1200.50")
    expect(result.expectedQuantityMt).toBe("25.320")
  })
  it("does not require client-submitted owner for Deal creation", () => {
    const result = createDealSchema.parse({
      vendorId: id,
      pickupLocationId: id,
      materialId: id,
      purchaseRate: "1200.00",
      expectedQuantityMt: "",
      notes: "",
    })
    expect(result.ownerMembershipId).toBeUndefined()
  })
  it("rejects an invalid rate", () => {
    expect(() =>
      createDealSchema.parse({
        vendorId: id,
        pickupLocationId: id,
        materialId: id,
        purchaseRate: "1.001",
        expectedQuantityMt: "",
        ownerMembershipId: id,
        notes: "",
      })
    ).toThrow()
  })
  it("requires delivery business fields and exposes no vehicle input", () => {
    expect(
      confirmDeliverySchema.safeParse({
        id,
        version: 1,
        challanNumber: "",
        finalWeightMt: "24.930",
        weighmentCardNumber: "W-1",
      }).success
    ).toBe(false)
    expect(
      "vehicleId" in
        confirmDeliverySchema.parse({
          id,
          version: 1,
          challanNumber: "C-1",
          finalWeightMt: "24.930",
          weighmentCardNumber: "W-1",
          vehicleId: id,
        })
    ).toBe(false)
  })
})
