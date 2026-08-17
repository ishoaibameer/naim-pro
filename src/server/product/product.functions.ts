import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import { adminMiddleware, operationsMiddleware } from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.server"
import { getReport, getReportMasters } from "./reports.server"
import {
  globalSearchSchema,
  notificationListSchema,
  notificationMutationSchema,
  organizationSettingsSchema,
  reportFilterSchema,
} from "./schemas"
import { globalSearch } from "./search.server"
import {
  getOrganizationSettings,
  saveOrganizationSettings,
} from "./settings.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

function mutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const getOrganizationSettingsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getOrganizationSettings(context.auth)
  })

export const saveOrganizationSettingsFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(organizationSettingsSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return saveOrganizationSettings(context.auth, data)
  })

export const getReportMastersFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getReportMasters(context.auth)
  })

export const getReportFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(reportFilterSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getReport(context.auth, data)
  })

export const globalSearchFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(globalSearchSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return globalSearch(context.auth, data.q)
  })

export const listNotificationsFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(notificationListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listNotifications(context.auth, data.tab)
  })

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .validator(notificationMutationSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return markNotificationRead(context.auth, data.id)
  })

export const markAllNotificationsReadFn = createServerFn({ method: "POST" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    mutationRequest()
    return markAllNotificationsRead(context.auth)
  })
