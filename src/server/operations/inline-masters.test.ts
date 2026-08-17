// @vitest-environment node

import { describe, expect, it } from "vitest"

import { ForbiddenError } from "@/server/auth/policy"
import type { AuthRole, SafeAuthContext } from "@/server/auth/types"
import {
  createInlineLocationSchema,
  createInlineMaterialSchema,
  createInlineVendorSchema,
} from "./schemas"
import { requireOperationsActor } from "./shared.server"

function actor(role: AuthRole): SafeAuthContext {
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Inline Master Test",
      status: "ACTIVE",
    },
    membership: {
      id: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000003",
      role,
      status: "ACTIVE",
    },
  }
}

describe("inline master authorization", () => {
  it("permits ADMIN and MEMBER but rejects VENDOR and DRIVER", () => {
    expect(requireOperationsActor(actor("ADMIN"))).toBe(
      "00000000-0000-4000-8000-000000000003"
    )
    expect(requireOperationsActor(actor("MEMBER"))).toBe(
      "00000000-0000-4000-8000-000000000003"
    )
    expect(() => requireOperationsActor(actor("VENDOR"))).toThrow(
      ForbiddenError
    )
    expect(() => requireOperationsActor(actor("DRIVER"))).toThrow(
      ForbiddenError
    )
  })
})

describe("inline master validation", () => {
  it("accepts only the controlled Vendor fields", () => {
    expect(
      createInlineVendorSchema.safeParse({
        name: "Timber Vendor",
        contactPerson: "",
        phone: "",
        location: "",
        notes: "",
      }).success
    ).toBe(true)
    expect(createInlineVendorSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("defaults Location creation to an explicit valid type", () => {
    expect(
      createInlineLocationSchema.safeParse({
        name: "Forest Depot",
        type: "PICKUP",
        address: "",
      }).success
    ).toBe(true)
    expect(
      createInlineLocationSchema.safeParse({
        name: "Forest Depot",
        type: "INVALID",
        address: "",
      }).success
    ).toBe(false)
  })

  it("requires a Material name", () => {
    expect(
      createInlineMaterialSchema.safeParse({
        name: "Teak",
        description: "",
      }).success
    ).toBe(true)
    expect(
      createInlineMaterialSchema.safeParse({ name: "", description: "" })
        .success
    ).toBe(false)
  })
})
