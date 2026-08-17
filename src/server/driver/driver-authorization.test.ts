// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { canAccessDriverTripScope } from "@/server/auth/policy"
import type { SafeAuthContext } from "@/server/auth/types"

function source(file: string) {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")
}

const service = source("driver.server.ts")
const functions = source("driver.functions.ts")
const tripService = source("../operations/trips.server.ts")
const documentAuthorization = source("../documents/authorization.server.ts")
const customFields = source("../custom-fields/values.server.ts")
const schema = source("../db/schema/driver-operations.ts")
const middleware = source("../auth/middleware.ts")
const driverRoute = source("../../routes/_authenticated/driver.tsx")
const adminRoute = source("../../routes/_authenticated/admin.tsx")
const memberRoute = source("../../routes/_authenticated/app.tsx")
const vendorRoute = source("../../routes/_authenticated/vendor.tsx")

const driverAuth: SafeAuthContext = {
  user: { id: "user-driver-a", name: "Driver A", status: "ACTIVE" },
  membership: {
    id: "membership-a",
    organizationId: "organization-a",
    role: "DRIVER",
    status: "ACTIVE",
  },
}

describe("Driver portal authorization invariants", () => {
  it("resolves only the active Driver linked to the authenticated user and organization", () => {
    expect(service).toContain('requireRole(actor, ["DRIVER"])')
    expect(service).toContain("eq(drivers.organizationId, organizationId)")
    expect(service).toContain("eq(drivers.userId, actor.user.id)")
    expect(service).toContain('eq(drivers.status, "ACTIVE")')
  })

  it("allows assigned scope and rejects another Driver's scope", () => {
    expect(canAccessDriverTripScope(driverAuth, ["user-driver-a"])).toBe(true)
    expect(canAccessDriverTripScope(driverAuth, ["user-driver-b"])).toBe(false)
    expect(service).toContain("eq(tripAssignments.driverId, driverId)")
    expect(service).toContain(
      "assignmentExists(transaction, organizationId, driver.id, current)"
    )
  })

  it("requires current assignment for mutations and historical assignment for reads", () => {
    expect(service).toMatch(
      /requireDriverTripAccess\(\s*actor,\s*input\.id,\s*true,\s*tx\s*\)/
    )
    expect(service).toMatch(
      /requireDriverTripAccess\(\s*actor,\s*input\.tripId,\s*true,\s*tx\s*\)/
    )
    expect(documentAuthorization).toContain('mode !== "VIEW"')
    expect(documentAuthorization).toContain("context.driverId !== driverId")
  })

  it("does not expose commercial finance or Driver delivery mutations", () => {
    for (const forbidden of [
      "purchaseRate",
      "agreedFreightAmount",
      "vendorBalance",
      "companyReceived",
      "settlementAmount",
    ])
      expect(service).not.toContain(forbidden)
    expect(functions).not.toContain("confirmDelivery")
    expect(functions).not.toContain("finalWeight")
    expect(functions).not.toContain("settle")
    expect(functions).not.toContain("archive")
  })

  it("reuses the central state machine and records Driver check-ins", () => {
    expect(tripService).toContain(
      "assertTripTransition(record.status, toStatus)"
    )
    expect(tripService).toContain("startJourneyForDriver")
    expect(tripService).toContain('"IN_TRANSIT"')
    expect(tripService).toContain('type: "JOURNEY_STARTED"')
    expect(service).toContain("driverCheckIns")
  })

  it("enforces Driver document and custom-field assignment scope", () => {
    expect(documentAuthorization).toContain("driverHasAssignment")
    expect(documentAuthorization).toContain('eq(drivers.status, "ACTIVE")')
    expect(customFields).toContain(
      'authorizeDocumentTarget(actor, targetResource, "EDIT")'
    )
    expect(customFields).toContain("targetEditable")
    expect(customFields).toContain('actor.membership.role === "DRIVER"')
  })

  it("keeps expenses pending, auditable, non-deletable, and separate from Payments", () => {
    expect(schema).toContain('.default("PENDING")')
    expect(schema).not.toContain("payments")
    expect(service).not.toContain(".delete(")
    expect(service).toContain('entityType: "DRIVER_EXPENSE"')
    expect(functions).toContain("operationsMiddleware")
  })

  it("keeps all role workspaces behind their server role guards", () => {
    expect(driverRoute).toContain("requireDriverAccessFn")
    expect(adminRoute).toContain("requireAdminAccessFn")
    expect(memberRoute).toContain("requireOperationsAccessFn")
    expect(vendorRoute).toContain("requireVendorAccessFn")
    expect(middleware).toContain('requireRole(context.auth, ["DRIVER"])')
  })

  it("scopes every Driver query by organization", () => {
    expect(service.match(/organizationId/g)?.length).toBeGreaterThan(40)
    expect(schema).toContain("driver_check_ins_trip_fk")
    expect(schema).toContain("driver_expenses_trip_fk")
    expect(schema).toContain("driver_expenses_receipt_document_fk")
  })
})
