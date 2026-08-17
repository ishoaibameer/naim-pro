import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import {
  driverMiddleware,
  operationsMiddleware,
} from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import {
  attachDriverExpenseReceiptSchema,
  createDriverExpenseSchema,
  driverCheckInSchema,
  driverEntitySchema,
  driverTripListSchema,
  driverTripMutationSchema,
  reviewDriverExpenseSchema,
} from "./schemas"
import {
  attachDriverExpenseReceipt,
  createDriverCheckIn,
  createDriverExpense,
  getDriverHome,
  getDriverProfile,
  getDriverTrip,
  listDriverActiveTrips,
  listDriverHistory,
  listOperationalDriverExpenses,
  requireLinkedDriver,
  reviewDriverExpense,
  startDriverJourney,
} from "./driver.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

function mutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const requireDriverAccessFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return {
      user: context.auth.user,
      driver: await requireLinkedDriver(context.auth),
    }
  })

export const getDriverHomeFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getDriverHome(context.auth)
  })

export const listDriverActiveTripsFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return listDriverActiveTrips(context.auth)
  })

export const listDriverHistoryFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .validator(driverTripListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listDriverHistory(context.auth, data)
  })

export const getDriverTripFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .validator(driverEntitySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getDriverTrip(context.auth, data.id)
  })

export const createDriverCheckInFn = createServerFn({ method: "POST" })
  .middleware([driverMiddleware])
  .validator(driverCheckInSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createDriverCheckIn(context.auth, data)
  })

export const startDriverJourneyFn = createServerFn({ method: "POST" })
  .middleware([driverMiddleware])
  .validator(driverTripMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return startDriverJourney(context.auth, data)
  })

export const createDriverExpenseFn = createServerFn({ method: "POST" })
  .middleware([driverMiddleware])
  .validator(createDriverExpenseSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return createDriverExpense(context.auth, data)
  })

export const attachDriverExpenseReceiptFn = createServerFn({ method: "POST" })
  .middleware([driverMiddleware])
  .validator(attachDriverExpenseReceiptSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return attachDriverExpenseReceipt(context.auth, data)
  })

export const getDriverProfileFn = createServerFn({ method: "GET" })
  .middleware([driverMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getDriverProfile(context.auth)
  })

export const listOperationalDriverExpensesFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(driverEntitySchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listOperationalDriverExpenses(context.auth, data.id)
  })

export const reviewDriverExpenseFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(reviewDriverExpenseSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return reviewDriverExpense(context.auth, data)
  })
