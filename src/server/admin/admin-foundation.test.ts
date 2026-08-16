// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { DuplicatePhoneError } from "@/server/auth/admin.server"
import { ForbiddenError } from "@/server/auth/policy"
import type { AuthRole, SafeAuthContext } from "@/server/auth/types"
import { getRoleHomePath } from "@/lib/auth-routing"

import {
  driverCreateSchema,
  memberCreateSchema,
  vendorCreateSchema,
} from "./schemas"
import {
  normalizeName,
  normalizeRegistration,
  requireAdmin,
} from "./shared.server"

function authFor(
  role: AuthRole,
  organizationId = "00000000-0000-4000-8000-000000000001"
): SafeAuthContext {
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Test User",
      status: "ACTIVE",
    },
    membership: {
      id: "00000000-0000-4000-8000-000000000003",
      organizationId,
      role,
      status: "ACTIVE",
    },
  }
}

describe("admin authorization and role routing", () => {
  it("allows only an active ADMIN context into admin services", () => {
    expect(requireAdmin(authFor("ADMIN"))).toBe(
      "00000000-0000-4000-8000-000000000001"
    )
    for (const role of ["MEMBER", "VENDOR", "DRIVER"] as const) {
      expect(() => requireAdmin(authFor(role))).toThrow(ForbiddenError)
    }
  })

  it("routes every role to its isolated workspace", () => {
    expect(getRoleHomePath("ADMIN")).toBe("/admin")
    expect(getRoleHomePath("MEMBER")).toBe("/app")
    expect(getRoleHomePath("VENDOR")).toBe("/vendor")
    expect(getRoleHomePath("DRIVER")).toBe("/driver")
  })
})

describe("admin creation validation", () => {
  it("validates member creation and rejects short temporary passwords", () => {
    expect(
      memberCreateSchema.safeParse({
        name: "Member One",
        phone: "9876543210",
        password: "temporary1",
        status: "ACTIVE",
      }).success
    ).toBe(true)
    expect(
      memberCreateSchema.safeParse({
        name: "Member One",
        phone: "9876543210",
        password: "short",
        status: "ACTIVE",
      }).success
    ).toBe(false)
  })

  it("supports a vendor without login and requires all linked-login credentials", () => {
    const businessOnly = {
      name: "Vendor One",
      contactPerson: "",
      phone: "",
      location: "",
      notes: "",
      status: "ACTIVE" as const,
      loginEnabled: false,
      loginName: "",
      loginPhone: "",
      temporaryPassword: "",
    }
    expect(vendorCreateSchema.safeParse(businessOnly).success).toBe(true)
    expect(
      vendorCreateSchema.safeParse({ ...businessOnly, loginEnabled: true })
        .success
    ).toBe(false)
    expect(
      vendorCreateSchema.safeParse({
        ...businessOnly,
        loginEnabled: true,
        loginName: "Vendor Login",
        loginPhone: "9876543210",
        temporaryPassword: "temporary1",
      }).success
    ).toBe(true)
  })

  it("requires complete login data for linked driver users", () => {
    const parsed = driverCreateSchema.safeParse({
      name: "Driver One",
      phone: "9876543210",
      transporterId: "",
      status: "ACTIVE",
      loginEnabled: true,
      loginName: "Driver Login",
      loginPhone: "9876543210",
      temporaryPassword: "temporary1",
    })
    expect(parsed.success).toBe(true)
  })

  it("uses a safe duplicate-phone error without echoing the phone", () => {
    const error = new DuplicatePhoneError()
    expect(error.message).toBe("A user with this phone number already exists.")
    expect(error.message).not.toMatch(/[0-9]{10}/)
  })
})

describe("normalization and mutation invariants", () => {
  it("normalizes searchable names and vehicle registrations", () => {
    expect(normalizeName("  North   Woods  ")).toBe("north woods")
    expect(normalizeRegistration("ka 01-ab-1234")).toBe("KA01AB1234")
  })

  it("contains no hard-delete path in admin domain services", () => {
    const files = [
      "accounts.server.ts",
      "companies.server.ts",
      "drivers.server.ts",
      "locations.server.ts",
      "materials.server.ts",
      "members.server.ts",
      "transporters.server.ts",
      "vehicles.server.ts",
      "vendors.server.ts",
    ]
    for (const file of files) {
      const source = readFileSync(
        fileURLToPath(new URL(file, import.meta.url)),
        "utf8"
      )
      expect(source).not.toContain(".delete(")
    }
  })

  it("revokes sessions in password reset and account deactivation services", () => {
    const resetSource = readFileSync(
      fileURLToPath(new URL("../auth/admin.server.ts", import.meta.url)),
      "utf8"
    )
    const deactivateSource = readFileSync(
      fileURLToPath(new URL("accounts.server.ts", import.meta.url)),
      "utf8"
    )
    expect(resetSource).toContain(".update(sessions)")
    expect(resetSource).toContain("revokedAt: now")
    expect(deactivateSource).toContain(".update(sessions)")
    expect(deactivateSource).toContain("revokedAt: now")
  })
})
