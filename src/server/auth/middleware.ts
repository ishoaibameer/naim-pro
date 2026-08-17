import { createMiddleware } from "@tanstack/react-start"

import { getCurrentAuthContext } from "./session.server"
import { requireAuthenticatedUser, requireRole } from "./policy"

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const auth = requireAuthenticatedUser(await getCurrentAuthContext())
    return next({ context: { auth } })
  }
)

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    requireRole(context.auth, ["ADMIN"])
    return next()
  })

export const operationsMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    requireRole(context.auth, ["ADMIN", "MEMBER"])
    return next()
  })

export const vendorMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    requireRole(context.auth, ["VENDOR"])
    return next()
  })

export const driverMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    requireRole(context.auth, ["DRIVER"])
    return next()
  })
