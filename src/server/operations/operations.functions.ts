import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import { operationsMiddleware } from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import { listOperationalActivity } from "./activity.server"
import { getOperationsDashboard } from "./dashboard.server"
import { createDeal, getDeal, listDeals } from "./deals.server"
import { getOperationalMasters } from "./masters.server"
import {
  cancelTripSchema,
  confirmDeliverySchema,
  confirmLoadingSchema,
  createDealSchema,
  createTripSchema,
  dealListSchema,
  entityIdSchema,
  tripListSchema,
  tripMutationSchema,
} from "./schemas"
import {
  cancelTrip,
  confirmDelivery,
  confirmLoading,
  createTrip,
  getTrip,
  listTrips,
  startJourney,
  startLoading,
} from "./trips.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}
function mutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const requireOperationsAccessFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return context.auth
  })
export const getOperationsDashboardFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getOperationsDashboard(context.auth)
  })
export const getOperationalMastersFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getOperationalMasters(context.auth)
  })
export const listDealsFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(dealListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listDeals(context.auth, data)
  })
export const getDealFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(entityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getDeal(context.auth, data.id)
  })
export const createDealFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(createDealSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createDeal(context.auth, data)
  })
export const listTripsFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(tripListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listTrips(context.auth, data)
  })
export const getTripFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(entityIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getTrip(context.auth, data.id)
  })
export const createTripFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(createTripSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createTrip(context.auth, data)
  })
export const startLoadingFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(tripMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return startLoading(context.auth, data)
  })
export const confirmLoadingFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(confirmLoadingSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return confirmLoading(context.auth, data)
  })
export const startJourneyFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(tripMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return startJourney(context.auth, data)
  })
export const confirmDeliveryFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(confirmDeliverySchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return confirmDelivery(context.auth, data)
  })
export const cancelTripFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(cancelTripSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return cancelTrip(context.auth, data)
  })
export const listOperationalActivityFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return listOperationalActivity(context.auth)
  })
