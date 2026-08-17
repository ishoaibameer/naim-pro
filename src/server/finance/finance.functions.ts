import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import { adminMiddleware, operationsMiddleware } from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import { listArchive } from "./archive.server"
import { createBill, getBill, issueBill, voidBill } from "./bills.server"
import { getFinanceDashboard } from "./dashboard.server"
import { getFinanceMasters } from "./masters.server"
import {
  createPayment,
  getPayment,
  listPayments,
  reversePayment,
} from "./payments.server"
import {
  getCompanyFinance,
  getTransporterFinance,
  getVendorFinance,
} from "./parties.server"
import {
  archiveListSchema,
  billCreateSchema,
  billMutationSchema,
  closeDealSchema,
  createPaymentSchema,
  financeEntityIdSchema,
  paymentListSchema,
  reversePaymentSchema,
  setFreightSchema,
  tripFinanceMutationSchema,
  voidBillSchema,
} from "./schemas"
import {
  archiveTrip,
  beginSettlement,
  closeDeal,
  completeSettlement,
  setTripFreight,
} from "./settlement.server"
import { getDealFinance, getTripFinance } from "./summary.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}
function mutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const getFinanceMastersFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getFinanceMasters(context.auth)
  })
export const getFinanceDashboardFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getFinanceDashboard(context.auth)
  })
export const listPaymentsFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(paymentListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listPayments(context.auth, data)
  })
export const getPaymentFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getPayment(context.auth, data.id)
  })
export const createPaymentFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(createPaymentSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createPayment(context.auth, data)
  })
export const reversePaymentFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(reversePaymentSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return reversePayment(context.auth, data)
  })
export const createBillFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(billCreateSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createBill(context.auth, data)
  })
export const getBillFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getBill(context.auth, data.id)
  })
export const issueBillFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(billMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return issueBill(context.auth, data)
  })
export const voidBillFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(voidBillSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return voidBill(context.auth, data)
  })
export const getTripFinanceFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getTripFinance(context.auth, data.id)
  })
export const getDealFinanceFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getDealFinance(context.auth, data.id)
  })
export const setTripFreightFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(setFreightSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return setTripFreight(context.auth, data)
  })
export const beginSettlementFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(tripFinanceMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return beginSettlement(context.auth, data)
  })
export const completeSettlementFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(tripFinanceMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return completeSettlement(context.auth, data)
  })
export const archiveTripFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(tripFinanceMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return archiveTrip(context.auth, data)
  })
export const closeDealFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(closeDealSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return closeDeal(context.auth, data)
  })
export const listArchiveFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(archiveListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listArchive(context.auth, data)
  })
export const getVendorFinanceFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getVendorFinance(context.auth, data.id)
  })
export const getTransporterFinanceFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getTransporterFinance(context.auth, data.id)
  })
export const getCompanyFinanceFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(financeEntityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getCompanyFinance(context.auth, data.id)
  })
