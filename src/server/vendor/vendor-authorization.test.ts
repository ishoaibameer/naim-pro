// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { canRoleUploadDocument } from "@/server/documents/policy"

function source(file: string) {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")
}

const service = source("vendor.server.ts")
const functions = source("vendor.functions.ts")
const middleware = source("../auth/middleware.ts")
const operations = source("../operations/operations.functions.ts")
const customFields = source("../custom-fields/values.server.ts")
const vendorRoute = source("../../routes/_authenticated/vendor.tsx")
const adminRoute = source("../../routes/_authenticated/admin.tsx")
const memberRoute = source("../../routes/_authenticated/app.tsx")

describe("vendor portal authorization invariants", () => {
  it("guards every vendor read model with the Vendor middleware", () => {
    expect(functions.match(/middleware\(\[vendorMiddleware\]\)/g)?.length).toBe(
      7
    )
    expect(middleware).toContain('requireRole(context.auth, ["VENDOR"])')
  })

  it("resolves the linked Vendor from organization and authenticated user", () => {
    expect(service).toContain('requireRole(actor, ["VENDOR"])')
    expect(service).toContain(
      "eq(vendors.organizationId, actor.membership.organizationId)"
    )
    expect(service).toContain("eq(vendors.userId, actor.user.id)")
  })

  it("scopes load list and detail records to organization and linked Vendor", () => {
    expect(service).toContain("eq(trips.organizationId, organizationId)")
    expect(service).toContain(
      "eq(trips.organizationId, actor.membership.organizationId)"
    )
    expect(
      service.match(/eq\(deals\.vendorId, vendor\.id\)/g)?.length
    ).toBeGreaterThan(3)
    expect(service).toContain("eq(trips.id, tripId)")
  })

  it("scopes payments and documents to the linked Vendor", () => {
    expect(service).toContain("eq(payments.vendorId, vendorId)")
    expect(service).toContain("eq(documentAttachments.vendorId, vendorId)")
    expect(service).toContain("eq(documentTripDeals.vendorId, vendorId)")
    expect(service).toContain("eq(documentPayments.vendorId, vendorId)")
  })

  it("does not expose internal finance fields in the Vendor read model", () => {
    for (const forbidden of [
      "billedAmount",
      "agreedFreight",
      "companyReceived",
      "recordedByMembershipId",
      "reversalReason",
    ])
      expect(service).not.toContain(forbidden)
  })

  it("does not let Vendors upload payment receipts or bills", () => {
    expect(canRoleUploadDocument("VENDOR", "VENDOR", "PERMIT")).toBe(true)
    expect(canRoleUploadDocument("VENDOR", "TRIP", "LOADING_PHOTO")).toBe(true)
    expect(canRoleUploadDocument("VENDOR", "PAYMENT", "PAYMENT_RECEIPT")).toBe(
      false
    )
    expect(canRoleUploadDocument("VENDOR", "BILL", "BILL")).toBe(false)
  })

  it("keeps lifecycle actions out of the Vendor API and checks custom-field roles", () => {
    expect(functions).not.toContain("transition")
    expect(operations).toContain("operationsMiddleware")
    expect(customFields).toContain("roleCanSee(actor.membership.role")
    expect(customFields).toContain("roleCanEdit(actor.membership.role")
    expect(customFields).toContain("authorizeDocumentTarget")
  })

  it("keeps Vendor, Admin, and Member navigation behind server role guards", () => {
    expect(vendorRoute).toContain("requireVendorAccessFn")
    expect(adminRoute).toContain("requireAdminAccessFn")
    expect(memberRoute).toContain("requireOperationsAccessFn")
    expect(middleware).toContain('requireRole(context.auth, ["ADMIN"])')
    expect(middleware).toContain(
      'requireRole(context.auth, ["ADMIN", "MEMBER"])'
    )
  })
})
