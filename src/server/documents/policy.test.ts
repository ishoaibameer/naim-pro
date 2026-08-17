import { describe, expect, it } from "vitest"

import { ForbiddenError } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"
import { assertDocumentOrganizationAccess } from "./authorization.server"
import {
  allowedDocumentTypes,
  assertDocumentTypeForTarget,
  canRoleUploadDocument,
} from "./policy"

describe("document policy", () => {
  const actor: SafeAuthContext = {
    user: { id: "user-1", name: "Member", status: "ACTIVE" },
    membership: {
      id: "membership-1",
      organizationId: "organization-1",
      role: "MEMBER",
      status: "ACTIVE",
    },
  }

  it("rejects cross-organization document targets", () => {
    expect(() =>
      assertDocumentOrganizationAccess(actor, "organization-2")
    ).toThrow(ForbiddenError)
    expect(() =>
      assertDocumentOrganizationAccess(actor, "organization-1")
    ).not.toThrow()
  })

  it("keeps payment receipts and bills on their explicit relational targets", () => {
    expect(allowedDocumentTypes("PAYMENT")).toContain("PAYMENT_RECEIPT")
    expect(allowedDocumentTypes("BILL")).toContain("BILL")
    expect(() =>
      assertDocumentTypeForTarget("TRIP", "PAYMENT_RECEIPT")
    ).toThrow()
    expect(() => assertDocumentTypeForTarget("PAYMENT", "BILL")).toThrow()
  })

  it("distinguishes replaceable vehicle profile photos from trip evidence", () => {
    expect(allowedDocumentTypes("VEHICLE")).toContain("VEHICLE_PHOTO")
    expect(allowedDocumentTypes("TRIP")).toContain("LOADING_PHOTO")
    expect(() => assertDocumentTypeForTarget("TRIP", "VEHICLE_PHOTO")).toThrow()
  })

  it("limits future vendor and driver upload capabilities by context", () => {
    expect(canRoleUploadDocument("VENDOR", "PAYMENT", "PAYMENT_RECEIPT")).toBe(
      false
    )
    expect(canRoleUploadDocument("VENDOR", "VEHICLE", "VEHICLE_PHOTO")).toBe(
      false
    )
    expect(canRoleUploadDocument("DRIVER", "TRIP", "LOADING_PHOTO")).toBe(true)
    expect(canRoleUploadDocument("DRIVER", "DEAL", "OTHER")).toBe(false)
  })
})
