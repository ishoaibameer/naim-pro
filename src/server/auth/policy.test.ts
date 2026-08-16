import { describe, expect, it } from "vitest"

import {
  canAccessDriverTripScope,
  canAccessVendorScope,
  ForbiddenError,
  requireRole,
} from "./policy"
import type { AuthRole, SafeAuthContext } from "./types"

function authFor(role: AuthRole, userId = "user-1"): SafeAuthContext {
  return {
    user: { id: userId, name: "Test User", status: "ACTIVE" },
    membership: {
      id: "membership-1",
      organizationId: "organization-1",
      role,
      status: "ACTIVE",
    },
  }
}

describe("authorization policy primitives", () => {
  it("allows ADMIN and rejects MEMBER for admin-only work", () => {
    expect(requireRole(authFor("ADMIN"), ["ADMIN"]).membership.role).toBe(
      "ADMIN"
    )
    expect(() => requireRole(authFor("MEMBER"), ["ADMIN"])).toThrow(
      ForbiddenError
    )
  })

  it("prevents a vendor from accessing an unrelated vendor scope", () => {
    expect(canAccessVendorScope(authFor("VENDOR"), "user-1")).toBe(true)
    expect(canAccessVendorScope(authFor("VENDOR"), "unrelated-user")).toBe(
      false
    )
  })

  it("prevents a driver from accessing an unrelated trip scope", () => {
    expect(canAccessDriverTripScope(authFor("DRIVER"), ["user-1"])).toBe(true)
    expect(
      canAccessDriverTripScope(authFor("DRIVER"), ["unrelated-driver"])
    ).toBe(false)
  })
})
