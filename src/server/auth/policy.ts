import type { AuthRole, SafeAuthContext } from "./types"

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.")
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("You are not authorized to perform this action.")
    this.name = "ForbiddenError"
  }
}

export function requireAuthenticatedUser(
  auth: SafeAuthContext | null
): SafeAuthContext {
  if (!auth || auth.user.status !== "ACTIVE") {
    throw new UnauthorizedError()
  }
  return auth
}

export function requireMembership(
  auth: SafeAuthContext,
  organizationId = auth.membership.organizationId
): SafeAuthContext["membership"] {
  if (
    auth.membership.status !== "ACTIVE" ||
    auth.membership.organizationId !== organizationId
  ) {
    throw new ForbiddenError()
  }
  return auth.membership
}

export function requireRole(
  auth: SafeAuthContext,
  allowedRoles: readonly AuthRole[]
): SafeAuthContext {
  requireMembership(auth)
  if (!allowedRoles.includes(auth.membership.role)) {
    throw new ForbiddenError()
  }
  return auth
}

export function canAccessVendorScope(
  auth: SafeAuthContext,
  vendorLinkedUserId: string | null
): boolean {
  if (auth.membership.role === "ADMIN" || auth.membership.role === "MEMBER") {
    return true
  }
  return (
    auth.membership.role === "VENDOR" && vendorLinkedUserId === auth.user.id
  )
}

export function canAccessDriverTripScope(
  auth: SafeAuthContext,
  assignedDriverUserIds: readonly string[]
): boolean {
  if (auth.membership.role === "ADMIN" || auth.membership.role === "MEMBER") {
    return true
  }
  return (
    auth.membership.role === "DRIVER" &&
    assignedDriverUserIds.includes(auth.user.id)
  )
}
