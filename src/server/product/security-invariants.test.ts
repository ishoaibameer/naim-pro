// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

function source(file: string) {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")
}

const reports = source("reports.server.ts")
const productFunctions = source("product.functions.ts")
const exportRoute = source("../../routes/api/reports/export.ts")
const search = source("search.server.ts")
const notificationReads = source("notifications.server.ts")
const notificationWrites = source("notifications-write.server.ts")
const settings = source("settings.server.ts")
const vendorShell = source("../../components/vendor/vendor-shell.tsx")
const driverShell = source("../../components/driver/driver-shell.tsx")
const archiveRoute = source("../../routes/_authenticated/app/archive.tsx")
const financeDashboard = source("../finance/dashboard.server.ts")

describe("Step 12 security and product invariants", () => {
  it("enforces Admin/Member authorization for reports, search, and notifications", () => {
    expect(
      productFunctions.match(/middleware\(\[operationsMiddleware\]\)/g)?.length
    ).toBe(6)
    expect(exportRoute).toContain("requireAuthenticatedUser")
    expect(exportRoute).toContain("getReport(actor, input)")
    expect(exportRoute).toContain("status: 403")
  })

  it("organization-scopes report and search database reads", () => {
    expect(reports).toContain("eq(trips.organizationId, organizationId)")
    expect(reports).toContain("eq(payments.organizationId, organizationId)")
    expect(search).toContain("requireOperationsActor(actor)")
    expect(search).toContain("eq(trips.organizationId, organizationId)")
    expect(search).toContain("eq(payments.organizationId, organizationId)")
  })

  it("scopes notification reads and writes to the current organization and recipient", () => {
    expect(notificationReads).toContain(
      "eq(notifications.organizationId, organizationId)"
    )
    expect(notificationReads).toContain(
      "eq(notifications.recipientMembershipId, actor.membership.id)"
    )
    expect(notificationWrites).toContain(
      "eq(memberships.organizationId, input.organizationId)"
    )
    expect(notificationWrites).toContain(
      'inArray(memberships.role, ["ADMIN", "MEMBER"])'
    )
  })

  it("persists settings with organization scope, optimistic locking, activity, and audit", () => {
    expect(settings).toContain("eq(organizations.id, organizationId)")
    expect(settings).toContain("before.version !== input.version")
    expect(settings).toContain("eq(organizations.version, before.version)")
    expect(settings).toContain("recordMutation")
  })

  it("keeps reports out of Vendor and Driver navigation", () => {
    expect(vendorShell).not.toContain('to="/app/reports"')
    expect(driverShell).not.toContain('to="/app/reports"')
  })

  it("keeps Archive read-only and finance summaries organization-scoped", () => {
    for (const mutation of ["archiveTripFn", "postPaymentFn", "voidBillFn"])
      expect(archiveRoute).not.toContain(mutation)
    expect(financeDashboard).toContain("organizationId")
    expect(financeDashboard).toContain("vendorPending")
    expect(financeDashboard).toContain("companyReceivable")
  })
})
