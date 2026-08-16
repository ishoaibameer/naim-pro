import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { adminMiddleware } from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"

import { listActivity } from "./activity.server"
import { setManagedAccountStatus } from "./accounts.server"
import { saveCompany, listCompanies } from "./companies.server"
import { getAdminDashboard } from "./dashboard.server"
import {
  createDriver,
  getDriver,
  listDrivers,
  setDriverStatus,
} from "./drivers.server"
import { listLocations, saveLocation } from "./locations.server"
import {
  createMember,
  getMember,
  listMembers,
  resetMemberPassword,
  setMemberStatus,
} from "./members.server"
import { listMaterials, saveMaterial } from "./materials.server"
import {
  accountStatusSchema,
  activityQuerySchema,
  companySchema,
  driverCreateSchema,
  entityIdSchema,
  listQuerySchema,
  locationSchema,
  materialSchema,
  memberCreateSchema,
  partyStatusSchema,
  passwordResetSchema,
  transporterSchema,
  vehicleSchema,
  vendorCreateSchema,
} from "./schemas"
import { listTransporters, saveTransporter } from "./transporters.server"
import {
  createVendor,
  getVendor,
  listVendors,
  setVendorStatus,
} from "./vendors.server"
import { listVehicles, saveVehicle } from "./vehicles.server"

const masterListSchema = z.object({
  search: z.string().trim().max(80).default(""),
})

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

function assertMutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const getAdminDashboardFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getAdminDashboard(context.auth)
  })

export const requireAdminAccessFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return context.auth
  })

export const listMembersFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(listQuerySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listMembers(context.auth, data)
  })

export const getMemberFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(entityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getMember(context.auth, data.id)
  })

export const createMemberFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(memberCreateSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return createMember(context.auth, data)
  })

export const setMemberStatusFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(accountStatusSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    await setMemberStatus(context.auth, data)
    return { success: true }
  })

export const resetMemberPasswordFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(passwordResetSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    await resetMemberPassword(context.auth, data)
    return { success: true }
  })

export const setManagedAccountStatusFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(accountStatusSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    await setManagedAccountStatus(context.auth, data)
    return { success: true }
  })

export const listVendorsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(listQuerySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listVendors(context.auth, data)
  })

export const getVendorFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(entityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getVendor(context.auth, data.id)
  })

export const createVendorFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(vendorCreateSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return createVendor(context.auth, data)
  })

export const listDriversFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(listQuerySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listDrivers(context.auth, data)
  })

export const getDriverFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(entityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getDriver(context.auth, data.id)
  })

export const createDriverFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(driverCreateSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return createDriver(context.auth, data)
  })

export const setPartyStatusFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(partyStatusSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    if (data.entity === "VENDOR") {
      await setVendorStatus(context.auth, data)
    } else if (data.entity === "DRIVER") {
      await setDriverStatus(context.auth, data)
    } else {
      throw new Error("Use the entity edit form to update this record status.")
    }
    return { success: true }
  })

export const listTransportersFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(masterListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listTransporters(context.auth, data.search)
  })

export const saveTransporterFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(transporterSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return saveTransporter(context.auth, data)
  })

export const listVehiclesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(masterListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listVehicles(context.auth, data.search)
  })

export const saveVehicleFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(vehicleSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return saveVehicle(context.auth, data)
  })

export const listCompaniesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(masterListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listCompanies(context.auth, data.search)
  })

export const saveCompanyFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(companySchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return saveCompany(context.auth, data)
  })

export const listMaterialsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(masterListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listMaterials(context.auth, data.search)
  })

export const saveMaterialFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(materialSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return saveMaterial(context.auth, data)
  })

export const listLocationsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(masterListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listLocations(context.auth, data.search)
  })

export const saveLocationFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(locationSchema)
  .handler(async ({ context, data }) => {
    assertMutationRequest()
    return saveLocation(context.auth, data)
  })

export const listActivityFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(activityQuerySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listActivity(context.auth, data)
  })
