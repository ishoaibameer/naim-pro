import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import postgres from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { z } from "zod"

import { saveCompany } from "@/server/admin/companies.server"
import { createDriver } from "@/server/admin/drivers.server"
import {
  createInlineLocation,
  saveLocation,
} from "@/server/admin/locations.server"
import {
  createInlineMaterial,
  saveMaterial,
} from "@/server/admin/materials.server"
import { createMember } from "@/server/admin/members.server"
import { saveTransporter } from "@/server/admin/transporters.server"
import { createInlineVendor, createVendor } from "@/server/admin/vendors.server"
import { saveVehicle } from "@/server/admin/vehicles.server"
import {
  authenticateWithPassword,
  logoutSession,
} from "@/server/auth/authentication.server"
import { hashPassword } from "@/server/auth/password.server"
import { normalizePhone } from "@/server/auth/phone"
import { ForbiddenError } from "@/server/auth/policy"
import { validateSession } from "@/server/auth/session.server"
import type { SafeAuthContext } from "@/server/auth/types"
import {
  getFormBuilder,
  saveCustomFieldDefinition,
} from "@/server/custom-fields/builder.server"
import {
  getCustomFieldData,
  saveCustomFieldValues,
} from "@/server/custom-fields/values.server"
import { closeDatabase, getDatabase } from "@/server/db/index.server"
import {
  activityEvents,
  auditEvents,
  bills,
  deals,
  documentVersions,
  drivers,
  memberships,
  organizations,
  payments,
  users,
  vendors,
} from "@/server/db/schema"
import {
  getDocument,
  readDocumentContent,
  uploadDocument,
} from "@/server/documents/documents.server"
import type { DocumentStorage } from "@/server/documents/storage.server"
import { setDocumentStorageForTests } from "@/server/documents/storage.server"
import {
  createDriverCheckIn,
  createDriverExpense,
  getDriverTrip,
  startDriverJourney,
} from "@/server/driver/driver.server"
import { createBill, issueBill } from "@/server/finance/bills.server"
import { createPayment, reversePayment } from "@/server/finance/payments.server"
import type { createPaymentSchema } from "@/server/finance/schemas"
import {
  archiveTrip,
  beginSettlement,
  completeSettlement,
  setTripFreight,
} from "@/server/finance/settlement.server"
import { getTripFinance } from "@/server/finance/summary.server"
import {
  createDeal,
  getDeal,
  reassignDealOwner,
} from "@/server/operations/deals.server"
import {
  confirmDelivery,
  confirmLoading,
  createTrip,
  startJourney,
  startLoading,
} from "@/server/operations/trips.server"
import { TripConcurrencyError } from "@/server/operations/trip-state"
import { getReport } from "@/server/product/reports.server"
import {
  getOrganizationSettings,
  saveOrganizationSettings,
} from "@/server/product/settings.server"
import {
  getVendorLoad,
  listVendorPayments,
} from "@/server/vendor/vendor.server"

let client: ReturnType<typeof postgres>

function guardedUrl() {
  const raw = process.env.TEST_DATABASE_URL
  if (!raw)
    throw new Error("TEST_DATABASE_URL is required for integration tests.")
  const url = new URL(raw)
  if (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    !/(?:test|ci)/i.test(url.pathname)
  )
    throw new Error("Integration tests require a non-production test database.")
  if (process.env.DATABASE_URL !== raw)
    throw new Error("Integration services must be bound to TEST_DATABASE_URL.")
  return raw
}

class MemoryStorage implements DocumentStorage {
  readonly objects = new Map<string, Uint8Array>()
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(key, bytes)
  }
  async read(key: string): Promise<Uint8Array> {
    const value = this.objects.get(key)
    if (!value) throw new Error("Missing test object.")
    return value
  }
  async metadata(key: string): Promise<{ sizeBytes: number }> {
    return { sizeBytes: (await this.read(key)).byteLength }
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }
}

async function resetTestDatabase() {
  const tables = await client<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  `
  if (!tables.length) return
  const identifiers = tables
    .map((table) => `"${table.tablename.replaceAll('"', '""')}"`)
    .join(", ")
  await client.unsafe(`truncate table ${identifiers} restart identity cascade`)
}

async function linkedActor(
  userId: string,
  role: "VENDOR" | "DRIVER"
): Promise<SafeAuthContext> {
  const row = (
    await getDatabase()
      .select({
        userId: users.id,
        name: users.name,
        userStatus: users.status,
        membershipId: memberships.id,
        organizationId: memberships.organizationId,
        role: memberships.role,
        membershipStatus: memberships.status,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1)
  ).at(0)
  if (!row || row.role !== role) throw new Error(`Missing linked ${role}.`)
  return {
    user: { id: row.userId, name: row.name, status: row.userStatus },
    membership: {
      id: row.membershipId,
      organizationId: row.organizationId,
      role,
      status: row.membershipStatus,
    },
  }
}

type PaymentInput = z.infer<typeof createPaymentSchema>

function paymentInput(
  overrides: Pick<PaymentInput, "partyId" | "partyType"> & Partial<PaymentInput>
): PaymentInput {
  return {
    idempotencyKey: randomUUID(),
    direction: "OUTGOING" as const,
    type: "PARTIAL" as const,
    amount: "1.00",
    paymentDate: "2026-08-17",
    paymentMode: "BANK_TRANSFER" as const,
    receiptNumber: null,
    notes: null,
    paidByMembershipId: null,
    dealId: null,
    tripId: null,
    billId: null,
    ...overrides,
  }
}

const reportFilters = {
  from: undefined,
  to: undefined,
  status: "ALL" as const,
  vendorId: undefined,
  vehicleId: undefined,
  driverId: undefined,
  transporterId: undefined,
  companyId: undefined,
  pickupId: undefined,
  destinationId: undefined,
  partyType: "ALL" as const,
  partyId: undefined,
  direction: "ALL" as const,
  paymentType: "ALL" as const,
  memberId: undefined,
  minDifferencePct: 0,
}

beforeAll(async () => {
  client = postgres(guardedUrl(), { max: 1, prepare: false })
  await resetTestDatabase()
  setDocumentStorageForTests(new MemoryStorage())
})

afterAll(async () => {
  setDocumentStorageForTests(undefined)
  await closeDatabase()
  await client.end()
})

describe("PostgreSQL staging acceptance", () => {
  it("runs the authoritative cross-domain workflow with isolation and reconciliation", async () => {
    const db = getDatabase()
    const adminPassword = "TestOnly-Acceptance-Admin-1!"
    const [organization] = await db
      .insert(organizations)
      .values({ name: "NAIM PRO Acceptance" })
      .returning()
    const [adminUser] = await db
      .insert(users)
      .values({
        name: "Acceptance Admin",
        phoneE164: normalizePhone("9000000101"),
        passwordHash: await hashPassword(adminPassword),
      })
      .returning()
    const [adminMembership] = await db
      .insert(memberships)
      .values({
        organizationId: organization.id,
        userId: adminUser.id,
        role: "ADMIN",
      })
      .returning()
    const admin: SafeAuthContext = {
      user: { id: adminUser.id, name: adminUser.name, status: "ACTIVE" },
      membership: {
        id: adminMembership.id,
        organizationId: organization.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    }

    const login = await authenticateWithPassword({
      phone: "9000000101",
      password: adminPassword,
      networkIdentifier: "integration-admin",
      userAgent: "Vitest",
    })
    expect((await validateSession(login.sessionToken))?.membership.role).toBe(
      "ADMIN"
    )
    await logoutSession(login.sessionToken)
    expect(await validateSession(login.sessionToken)).toBeNull()

    const member = await createMember(admin, {
      name: "Acceptance Member",
      phone: "9000000102",
      password: "TestOnly-Acceptance-Member-1!",
      status: "ACTIVE",
    })
    const secondMember = await createMember(admin, {
      name: "Acceptance Second Member",
      phone: "9000000106",
      password: "TestOnly-Acceptance-Member-2!",
      status: "ACTIVE",
    })
    const inlineVendor = await createInlineVendor(member, {
      name: "Inline Acceptance Vendor",
      contactPerson: "Inline Contact",
      phone: "9000000110",
      location: "Inline Location",
      notes: "Created from Deal form",
    })
    expect(inlineVendor.created).toBe(true)
    expect(
      await createInlineVendor(member, {
        name: "  INLINE   ACCEPTANCE VENDOR  ",
        contactPerson: "",
        phone: "",
        location: "",
        notes: "",
      })
    ).toMatchObject({ id: inlineVendor.id, created: false })
    const inlineLocation = await createInlineLocation(member, {
      name: "Inline Acceptance Depot",
      type: "PICKUP",
      address: "Inline address",
    })
    expect(
      await createInlineLocation(member, {
        name: "inline acceptance depot",
        type: "PICKUP",
        address: "",
      })
    ).toMatchObject({ id: inlineLocation.id, created: false })
    const inlineMaterial = await createInlineMaterial(member, {
      name: "Inline Acceptance Timber",
      description: "Inline material",
    })
    expect(
      await createInlineMaterial(member, {
        name: "INLINE ACCEPTANCE TIMBER",
        description: "",
      })
    ).toMatchObject({ id: inlineMaterial.id, created: false })
    const transporter = await saveTransporter(admin, {
      name: "Acceptance Transporter",
      contactPerson: "Dispatch",
      phone: "9000000190",
      location: "Nagpur",
      notes: "",
      status: "ACTIVE",
    })
    const vehicle = await saveVehicle(admin, {
      registrationNumber: "MH31ACCEPT1",
      transporterId: transporter.id,
      status: "ACTIVE",
    })
    const company = await saveCompany(admin, {
      name: "Acceptance Company",
      contactPerson: "Accounts",
      phone: "9000000191",
      location: "Pune",
      address: "Acceptance address",
      status: "ACTIVE",
    })
    const material = await saveMaterial(admin, {
      name: "Acceptance Timber",
      description: "Test material",
      status: "ACTIVE",
    })
    const pickup = await saveLocation(admin, {
      name: "Acceptance Forest Depot",
      type: "PICKUP",
      address: "Pickup",
      status: "ACTIVE",
    })
    const destination = await saveLocation(admin, {
      name: "Acceptance Mill",
      type: "DESTINATION",
      address: "Destination",
      status: "ACTIVE",
    })
    const vendor = await createVendor(admin, {
      name: "Acceptance Vendor",
      contactPerson: "Vendor Owner",
      phone: "9000000103",
      location: "Mandla",
      notes: "",
      status: "ACTIVE",
      loginEnabled: true,
      loginName: "Acceptance Vendor Login",
      loginPhone: "9000000103",
      temporaryPassword: "TestOnly-Acceptance-Vendor-1!",
    })
    const driver = await createDriver(admin, {
      name: "Acceptance Driver",
      phone: "9000000104",
      transporterId: transporter.id,
      status: "ACTIVE",
      loginEnabled: true,
      loginName: "Acceptance Driver Login",
      loginPhone: "9000000104",
      temporaryPassword: "TestOnly-Acceptance-Driver-1!",
    })
    const vendorRow = (
      await db.select().from(vendors).where(eq(vendors.id, vendor.id)).limit(1)
    )[0]
    const driverRow = (
      await db.select().from(drivers).where(eq(drivers.id, driver.id)).limit(1)
    )[0]
    expect(vendorRow.userId).toBeTruthy()
    expect(driverRow.userId).toBeTruthy()
    const vendorActor = await linkedActor(vendorRow.userId!, "VENDOR")
    const driverActor = await linkedActor(driverRow.userId!, "DRIVER")
    await expect(
      createInlineMaterial(vendorActor, {
        name: "Forbidden Vendor Material",
        description: "",
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      createInlineLocation(driverActor, {
        name: "Forbidden Driver Location",
        type: "PICKUP",
        address: "",
      })
    ).rejects.toBeInstanceOf(ForbiddenError)

    const deal = await createDeal(member, {
      vendorId: vendor.id,
      pickupLocationId: pickup.id,
      materialId: material.id,
      purchaseRate: "10000.00",
      expectedQuantityMt: "20.000",
      ownerMembershipId: secondMember.membership.id,
      notes: "Acceptance deal",
    })
    expect(deal.ownerMembershipId).toBe(member.membership.id)
    expect(deal.createdByMembershipId).toBe(member.membership.id)

    const adminChosenDeal = await createDeal(admin, {
      vendorId: vendor.id,
      pickupLocationId: pickup.id,
      materialId: material.id,
      purchaseRate: "10000.00",
      expectedQuantityMt: "1.000",
      ownerMembershipId: secondMember.membership.id,
      notes: "Admin owner choice",
    })
    expect(adminChosenDeal.ownerMembershipId).toBe(secondMember.membership.id)
    const firstTrip = await createTrip(member, {
      dealId: deal.id,
      transporterId: transporter.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      destinationCompanyId: company.id,
      destinationLocationId: destination.id,
    })
    const secondTrip = await createTrip(member, {
      dealId: deal.id,
      transporterId: transporter.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      destinationCompanyId: company.id,
      destinationLocationId: destination.id,
    })
    expect((await getDeal(member, deal.id)).trips).toHaveLength(2)

    await createDriverCheckIn(driverActor, {
      id: firstTrip.id,
      version: firstTrip.version,
      type: "REACHED_PICKUP",
      note: "At pickup",
      locationText: "Acceptance Forest Depot",
    })
    const loading = await startLoading(member, {
      id: firstTrip.id,
      version: firstTrip.version,
    })
    const expense = await createDriverExpense(driverActor, {
      tripId: firstTrip.id,
      type: "TOLL",
      amount: "250.00",
      expenseDate: "2026-08-17",
      note: "Acceptance toll",
    })
    expect(expense.status).toBe("PENDING")
    const loaded = await confirmLoading(member, {
      id: firstTrip.id,
      version: loading.version,
      loadedWeightMt: "10.000",
      challanNumber: "LOAD-ACCEPT-1",
      notes: "Loaded",
    })
    const transit = await startDriverJourney(driverActor, {
      id: firstTrip.id,
      version: loaded.version,
    })
    const delivered = await confirmDelivery(member, {
      id: firstTrip.id,
      version: transit.version,
      challanNumber: "DC-ACCEPT-1",
      finalWeightMt: "9.500",
      weighmentCardNumber: "WB-ACCEPT-1",
    })
    expect(delivered.weight.differenceMt).toBe("0.500")

    const secondLoading = await startLoading(member, {
      id: secondTrip.id,
      version: secondTrip.version,
    })
    const secondLoaded = await confirmLoading(member, {
      id: secondTrip.id,
      version: secondLoading.version,
      loadedWeightMt: "8.000",
      challanNumber: "LOAD-ACCEPT-2",
      notes: null,
    })
    const concurrent = await Promise.allSettled([
      startJourney(member, {
        id: secondTrip.id,
        version: secondLoaded.version,
      }),
      startJourney(member, {
        id: secondTrip.id,
        version: secondLoaded.version,
      }),
    ])
    expect(
      concurrent.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
      concurrent.filter((result) => result.status === "rejected")
    ).toHaveLength(1)
    expect(
      (
        concurrent.find(
          (result) => result.status === "rejected"
        ) as PromiseRejectedResult
      ).reason
    ).toBeInstanceOf(TripConcurrencyError)

    const advance = await createPayment(
      member,
      paymentInput({
        partyType: "VENDOR",
        partyId: vendor.id,
        type: "ADVANCE",
        amount: "20000.00",
        dealId: deal.id,
      })
    )
    await createPayment(
      member,
      paymentInput({
        partyType: "VENDOR",
        partyId: vendor.id,
        amount: "75000.00",
        dealId: deal.id,
      })
    )
    const reversible = await createPayment(
      member,
      paymentInput({
        partyType: "VENDOR",
        partyId: vendor.id,
        amount: "1000.00",
        tripId: firstTrip.id,
      })
    )
    const [reversibleRecord] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, reversible.id))
      .limit(1)
    await reversePayment(admin, {
      id: reversible.id,
      version: reversibleRecord.version,
      idempotencyKey: randomUUID(),
      reason: "Acceptance reversal",
    })
    expect(
      (await listVendorPayments(vendorActor)).items.some(
        (item) => item.id === advance.id
      )
    ).toBe(true)

    const freight = await setTripFreight(member, {
      id: firstTrip.id,
      version: delivered.version,
      amount: "10000.00",
    })
    await createPayment(
      member,
      paymentInput({
        partyType: "TRANSPORTER",
        partyId: transporter.id,
        amount: "10000.00",
        tripId: firstTrip.id,
      })
    )
    const bill = await createBill(member, {
      idempotencyKey: randomUUID(),
      companyId: company.id,
      billNumber: "BILL-ACCEPT-1",
      billDate: "2026-08-17",
      tripId: firstTrip.id,
      billedAmount: "120000.00",
      notes: null,
    })
    const [billRecord] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, bill.id))
      .limit(1)
    const issuedBill = await issueBill(admin, {
      id: bill.id,
      version: billRecord.version,
    })
    const settlementPending = await beginSettlement(member, {
      id: firstTrip.id,
      version: freight.version,
    })
    await expect(
      completeSettlement(admin, {
        id: firstTrip.id,
        version: settlementPending.version,
      })
    ).rejects.toThrow(/Settlement incomplete/)
    await createPayment(
      member,
      paymentInput({
        partyType: "COMPANY",
        partyId: company.id,
        direction: "INCOMING",
        type: "FINAL",
        amount: "120000.00",
        billId: bill.id,
      })
    )
    const finance = await getTripFinance(member, firstTrip.id)
    expect(finance.purchase.pending).toBe("0.00")
    expect(finance.transport.pending).toBe("0.00")
    expect(finance.sale.receivable).toBe("0.00")
    const settled = await completeSettlement(admin, {
      id: firstTrip.id,
      version: settlementPending.version,
    })
    const archived = await archiveTrip(admin, {
      id: firstTrip.id,
      version: settled.version,
    })
    expect(archived.status).toBe("ARCHIVED")
    expect(issuedBill.status).toBe("ISSUED")

    const otherVendor = await createVendor(admin, {
      name: "Other Acceptance Vendor",
      contactPerson: "Other",
      phone: "9000000105",
      location: "Other",
      notes: "",
      status: "ACTIVE",
      loginEnabled: true,
      loginName: "Other Vendor",
      loginPhone: "9000000105",
      temporaryPassword: "TestOnly-Acceptance-OtherVendor-1!",
    })
    const otherVendorRow = (
      await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, otherVendor.id))
        .limit(1)
    )[0]
    const otherVendorActor = await linkedActor(otherVendorRow.userId!, "VENDOR")
    await expect(
      getVendorLoad(otherVendorActor, firstTrip.id)
    ).rejects.toBeInstanceOf(ForbiddenError)

    const otherDriver = await createDriver(admin, {
      name: "Other Acceptance Driver",
      phone: "9000000106",
      transporterId: transporter.id,
      status: "ACTIVE",
      loginEnabled: true,
      loginName: "Other Driver",
      loginPhone: "9000000106",
      temporaryPassword: "TestOnly-Acceptance-OtherDriver-1!",
    })
    const otherDriverRow = (
      await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, otherDriver.id))
        .limit(1)
    )[0]
    const otherDriverActor = await linkedActor(otherDriverRow.userId!, "DRIVER")
    await expect(
      getDriverTrip(otherDriverActor, firstTrip.id)
    ).rejects.toBeInstanceOf(ForbiddenError)

    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const document = await uploadDocument(
      vendorActor,
      {
        targetType: "TRIP",
        targetId: firstTrip.id,
        documentType: "OTHER",
        title: "Acceptance evidence",
        description: "Private test evidence",
      },
      {
        name: "acceptance.png",
        type: "image/png",
        size: png.byteLength,
        arrayBuffer: async () => png.buffer,
      }
    )
    expect((await readDocumentContent(vendorActor, document.id)).bytes).toEqual(
      png
    )
    await expect(
      getDocument(otherVendorActor, document.id)
    ).rejects.toBeInstanceOf(ForbiddenError)

    const pdf = Uint8Array.from([
      37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 69, 79, 70,
    ])
    const pdfDocument = await uploadDocument(
      admin,
      {
        targetType: "TRIP",
        targetId: firstTrip.id,
        documentType: "OTHER",
        title: "Acceptance PDF",
        description: "Private PDF evidence",
      },
      {
        name: "acceptance.pdf",
        type: "application/pdf",
        size: pdf.byteLength,
        arrayBuffer: async () => pdf.buffer,
      }
    )
    expect((await readDocumentContent(admin, pdfDocument.id)).bytes).toEqual(
      pdf
    )

    const firstVehiclePhoto = await uploadDocument(
      admin,
      {
        targetType: "VEHICLE",
        targetId: vehicle.id,
        documentType: "VEHICLE_PHOTO",
        title: "Vehicle photo",
        description: "Initial private vehicle image",
      },
      {
        name: "vehicle.png",
        type: "image/png",
        size: png.byteLength,
        arrayBuffer: async () => png.buffer,
      }
    )
    const replacementPng = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4,
    ])
    const secondVehiclePhoto = await uploadDocument(
      admin,
      {
        targetType: "VEHICLE",
        targetId: vehicle.id,
        documentType: "VEHICLE_PHOTO",
        title: "Vehicle photo replacement",
        description: "Superseding private vehicle image",
      },
      {
        name: "vehicle-replacement.png",
        type: "image/png",
        size: replacementPng.byteLength,
        arrayBuffer: async () => replacementPng.buffer,
      }
    )
    expect(secondVehiclePhoto).toMatchObject({
      id: firstVehiclePhoto.id,
      versionNumber: 2,
    })
    expect(
      await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, firstVehiclePhoto.id))
    ).toHaveLength(2)
    expect(
      (await readDocumentContent(admin, firstVehiclePhoto.id)).bytes
    ).toEqual(replacementPng)

    const definition = await saveCustomFieldDefinition(admin, {
      target: "VENDOR",
      key: "acceptance_grade",
      label: "Acceptance Grade",
      fieldType: "TEXT",
      sectionKey: "BUSINESS",
      required: false,
      requiredRoles: [],
      visibleRoles: ["ADMIN", "MEMBER", "VENDOR"],
      editableRoles: ["ADMIN"],
      sortOrder: 10,
      maxLength: 50,
      allowedDocumentTypes: [],
      options: [],
    })
    await saveCustomFieldValues(admin, {
      target: "VENDOR",
      recordId: vendor.id,
      values: [{ definitionId: definition.id, value: "A" }],
    })
    const field = (await getFormBuilder(admin, "VENDOR")).customFields.find(
      (item) => item.id === definition.id
    )!
    await saveCustomFieldDefinition(admin, {
      id: field.id,
      version: field.version,
      target: "VENDOR",
      key: field.key,
      label: "Acceptance Timber Grade",
      fieldType: field.fieldType,
      sectionKey: field.sectionKey,
      required: field.required,
      requiredRoles: field.requiredRoles,
      visibleRoles: field.visibleRoles,
      editableRoles: field.editableRoles,
      sortOrder: field.sortOrder,
      maxLength: field.validation.maxLength,
      allowedDocumentTypes: [],
      options: [],
    })
    expect(
      (await getCustomFieldData(admin, "VENDOR", vendor.id)).fields.find(
        (item) => item.id === definition.id
      )
    ).toMatchObject({
      label: "Acceptance Timber Grade",
      value: "A",
      currentVersionNumber: 2,
    })

    const settings = await getOrganizationSettings(admin)
    const updatedSettings = await saveOrganizationSettings(admin, {
      name: "NAIM PRO Staging Acceptance",
      weightWarningThresholdPct: "2.000",
      expectedTransitDurationHours: 36,
      defaultPageSize: 25,
      version: settings.version,
    })
    expect(updatedSettings).toMatchObject({
      name: "NAIM PRO Staging Acceptance",
      weightWarningThresholdPct: "2.000",
      expectedTransitDurationHours: 36,
      defaultPageSize: 25,
    })

    const tripReport = await getReport(admin, {
      ...reportFilters,
      report: "TRIPS",
    })
    expect(
      tripReport.rows.find((row) => row.id === firstTrip.id)
    ).toMatchObject({
      loadedWeightMt: "10.000",
      finalWeightMt: "9.500",
      differenceMt: "0.500",
      status: "ARCHIVED",
    })
    const vendorReport = await getReport(admin, {
      ...reportFilters,
      report: "VENDORS",
    })
    expect(vendorReport.rows.find((row) => row.id === vendor.id)).toMatchObject(
      {
        deliveredWeightMt: "9.500",
        materialValue: "95000.00",
        paid: "95000.00",
        pending: "0.00",
      }
    )
    const transporterReport = await getReport(admin, {
      ...reportFilters,
      report: "TRANSPORTERS",
    })
    expect(
      transporterReport.rows.find((row) => row.id === transporter.id)
    ).toMatchObject({
      freight: "10000.00",
      paid: "10000.00",
      pending: "0.00",
    })
    const companyReport = await getReport(admin, {
      ...reportFilters,
      report: "COMPANIES",
    })
    expect(
      companyReport.rows.find((row) => row.id === company.id)
    ).toMatchObject({
      billed: "120000.00",
      received: "120000.00",
      receivable: "0.00",
    })
    expect(
      (await getReport(admin, { ...reportFilters, report: "PAYMENTS" })).rows
        .length
    ).toBe(6)
    expect(
      (
        await getReport(admin, { ...reportFilters, report: "WEIGHT" })
      ).rows.find((row) => row.id === firstTrip.id)
    ).toMatchObject({
      differenceMt: "0.500",
      differencePct: "5.0000",
    })

    const beforeDeals = await client<
      { count: string }[]
    >`select count(*)::text as count from deals`
    const [otherOrganization] = await db
      .insert(organizations)
      .values({ name: "Other Acceptance Organization" })
      .returning()
    const [foreignCreator] = await db
      .insert(memberships)
      .values({
        organizationId: otherOrganization.id,
        userId: adminUser.id,
        role: "ADMIN",
      })
      .returning()
    const [foreignMember] = await db
      .insert(memberships)
      .values({
        organizationId: otherOrganization.id,
        userId: adminUser.id,
        role: "MEMBER",
      })
      .returning()
    const foreignActor: SafeAuthContext = {
      user: admin.user,
      membership: {
        id: foreignCreator.id,
        organizationId: otherOrganization.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    }
    const foreignInlineVendor = await createInlineVendor(foreignActor, {
      name: "Inline Acceptance Vendor",
      contactPerson: "",
      phone: "",
      location: "",
      notes: "",
    })
    expect(foreignInlineVendor.id).not.toBe(inlineVendor.id)
    await expect(
      createDeal(admin, {
        vendorId: vendor.id,
        pickupLocationId: pickup.id,
        materialId: material.id,
        purchaseRate: "1.00",
        expectedQuantityMt: null,
        ownerMembershipId: foreignMember.id,
        notes: null,
      })
    ).rejects.toThrow(/Owner must be an active Member/)

    const reassignedDeal = await reassignDealOwner(admin, {
      id: adminChosenDeal.id,
      version: adminChosenDeal.version,
      ownerMembershipId: member.membership.id,
    })
    expect(reassignedDeal.ownerMembershipId).toBe(member.membership.id)
    const [reassignedDealRow] = await db
      .select({
        ownerMembershipId: deals.ownerMembershipId,
        updatedByMembershipId: deals.updatedByMembershipId,
      })
      .from(deals)
      .where(eq(deals.id, adminChosenDeal.id))
      .limit(1)
    expect(reassignedDealRow.ownerMembershipId).toBe(member.membership.id)
    expect(reassignedDealRow.updatedByMembershipId).toBe(admin.membership.id)
    const [reassignmentActivity] = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.entityId, adminChosenDeal.id),
          eq(activityEvents.eventType, "DEAL_OWNER_REASSIGNED")
        )
      )
      .limit(1)
    expect(reassignmentActivity).toBeTruthy()
    const [reassignmentAudit] = await db
      .select({
        action: auditEvents.action,
        actorMembershipId: auditEvents.actorMembershipId,
        before: auditEvents.before,
        after: auditEvents.after,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityId, adminChosenDeal.id),
          eq(auditEvents.action, "DEAL_OWNER_REASSIGNED")
        )
      )
      .limit(1)
    expect(reassignmentAudit).toMatchObject({
      action: "DEAL_OWNER_REASSIGNED",
      actorMembershipId: admin.membership.id,
      before: { ownerMembershipId: secondMember.membership.id },
      after: { ownerMembershipId: member.membership.id },
    })
    const [foreignVendor] = await db
      .insert(vendors)
      .values({
        organizationId: otherOrganization.id,
        name: "Foreign Vendor",
        normalizedName: "FOREIGN VENDOR",
        createdByMembershipId: foreignCreator.id,
        updatedByMembershipId: foreignCreator.id,
      })
      .returning()
    await expect(
      createDeal(member, {
        vendorId: foreignVendor.id,
        pickupLocationId: pickup.id,
        materialId: material.id,
        purchaseRate: "1.00",
        expectedQuantityMt: null,
        ownerMembershipId: member.membership.id,
        notes: null,
      })
    ).rejects.toThrow(/Vendor is not active/)
    const afterDeals = await client<
      { count: string }[]
    >`select count(*)::text as count from deals`
    expect(afterDeals[0].count).toBe(beforeDeals[0].count)
  }, 120_000)

  it("retains database-enforced audit UPDATE and DELETE protection", async () => {
    const rows = await client<{ tgname: string }[]>`
      select tgname from pg_trigger where tgrelid = 'audit_events'::regclass and not tgisinternal
    `
    expect(rows.map((row) => row.tgname)).toContain("audit_events_immutable")
    const [event] = await getDatabase()
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .limit(1)
    await expect(
      client`update audit_events set action = 'TAMPERED' where id = ${event.id}`
    ).rejects.toThrow()
    await expect(
      client`delete from audit_events where id = ${event.id}`
    ).rejects.toThrow()
  })

  it("has the critical domain tables and workflow records", async () => {
    const rows = await client<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'
        and table_name in ('users', 'sessions', 'deals', 'trips', 'payments', 'bills', 'documents', 'audit_events')
    `
    expect(new Set(rows.map((row) => row.table_name))).toEqual(
      new Set([
        "users",
        "sessions",
        "deals",
        "trips",
        "payments",
        "bills",
        "documents",
        "audit_events",
      ])
    )
    expect(
      (await getDatabase().select().from(payments)).length
    ).toBeGreaterThan(0)
    expect((await getDatabase().select().from(bills)).length).toBeGreaterThan(0)
  })
})
