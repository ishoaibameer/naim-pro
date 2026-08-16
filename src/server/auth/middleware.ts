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
