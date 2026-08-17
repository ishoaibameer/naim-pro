import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { createUserAccount, resetUserPassword } from "./admin.server"
import {
  authenticateWithPassword,
  logoutSession,
} from "./authentication.server"
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "./cookie.server"
import { adminMiddleware } from "./middleware"
import {
  assertSameOrigin,
  getNetworkIdentifier,
} from "./request-security.server"
import { getCurrentAuthContext, revokeSession } from "./session.server"
import { logger } from "@/server/observability/logger.server"

const loginInputSchema = z.object({
  phone: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(1024),
})

const createUserInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(64),
  password: z.string().min(10).max(1024),
  role: z.enum(["MEMBER", "VENDOR", "DRIVER"]),
  organizationId: z.uuid(),
})

const resetPasswordInputSchema = z.object({
  targetUserId: z.uuid(),
  newPassword: z.string().min(10).max(1024),
})

export const login = createServerFn({ method: "POST" })
  .validator(loginInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    assertSameOrigin(request)
    const priorToken = readSessionToken()
    const result = await authenticateWithPassword({
      ...data,
      networkIdentifier: getNetworkIdentifier(request),
      userAgent: request.headers.get("user-agent"),
    })

    if (priorToken) await revokeSession(priorToken)
    setSessionCookie(result.sessionToken)
    setResponseHeader("Cache-Control", "no-store")
    logger.info("auth.login.succeeded", {
      userId: result.auth.user.id,
      membershipId: result.auth.membership.id,
      organizationId: result.auth.membership.organizationId,
    })
    return result.auth
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest()
  assertSameOrigin(request)
  const token = readSessionToken()
  if (token) await logoutSession(token)
  clearSessionCookie()
  setResponseHeader("Cache-Control", "no-store")
  throw redirect({ to: "/login" })
})

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    setResponseHeader("Cache-Control", "no-store")
    return getCurrentAuthContext()
  }
)

export const createUserAccountFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(createUserInputSchema)
  .handler(async ({ context, data }) => {
    assertSameOrigin(getRequest())
    return createUserAccount(context.auth, data)
  })

export const resetUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(resetPasswordInputSchema)
  .handler(async ({ context, data }) => {
    assertSameOrigin(getRequest())
    await resetUserPassword(context.auth, data.targetUserId, data.newPassword)
    return { success: true }
  })
