import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

import { vendorMiddleware } from "@/server/auth/middleware"
import {
  vendorDocumentListSchema,
  vendorEntitySchema,
  vendorLoadListSchema,
} from "./schemas"
import {
  getVendorHome,
  getVendorLoad,
  getVendorProfile,
  listVendorDocuments,
  listVendorLoads,
  listVendorPayments,
  requireLinkedVendor,
} from "./vendor.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

export const requireVendorAccessFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .handler(async ({ context }) => {
    noStore()
    const vendor = await requireLinkedVendor(context.auth)
    return { user: context.auth.user, vendor }
  })

export const getVendorHomeFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getVendorHome(context.auth)
  })

export const listVendorLoadsFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .validator(vendorLoadListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listVendorLoads(context.auth, data)
  })

export const getVendorLoadFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .validator(vendorEntitySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getVendorLoad(context.auth, data.id)
  })

export const listVendorPaymentsFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return listVendorPayments(context.auth)
  })

export const listVendorDocumentsFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .validator(vendorDocumentListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listVendorDocuments(context.auth, data)
  })

export const getVendorProfileFn = createServerFn({ method: "GET" })
  .middleware([vendorMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getVendorProfile(context.auth)
  })
