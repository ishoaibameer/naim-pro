import { describe, expect, it } from "vitest"

import { ForbiddenError, requireRole } from "@/server/auth/policy"
import type { AuthRole, SafeAuthContext } from "@/server/auth/types"

function actor(role: AuthRole): SafeAuthContext {
  return {
    user: { id: "user-1", name: "Finance User", status: "ACTIVE" },
    membership: {
      id: "membership-1",
      organizationId: "organization-1",
      role,
      status: "ACTIVE",
    },
  }
}

describe("finance authorization boundaries", () => {
  it.each(["ADMIN", "MEMBER"] as const)(
    "allows %s to record operational finance entries",
    (role) => {
      expect(requireRole(actor(role), ["ADMIN", "MEMBER"])).toBeTruthy()
    }
  )

  it.each(["VENDOR", "DRIVER"] as const)(
    "rejects %s from internal finance entries",
    (role) => {
      expect(() => requireRole(actor(role), ["ADMIN", "MEMBER"])).toThrow(
        ForbiddenError
      )
    }
  )

  it("keeps reversal, issue, final settlement, and archive admin-only", () => {
    expect(requireRole(actor("ADMIN"), ["ADMIN"])).toBeTruthy()
    expect(() => requireRole(actor("MEMBER"), ["ADMIN"])).toThrow(
      ForbiddenError
    )
  })
})
