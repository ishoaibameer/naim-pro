import type { SessionRecordForValidation } from "./types"

export const SESSION_ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000
export const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 15 * 60 * 1000

export function isSessionRecordValid(
  session: SessionRecordForValidation,
  now = new Date()
): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime() &&
    now.getTime() - session.lastActiveAt.getTime() < SESSION_IDLE_TIMEOUT_MS &&
    session.userStatus === "ACTIVE" &&
    session.membershipStatus === "ACTIVE" &&
    session.organizationStatus === "ACTIVE" &&
    session.userSecurityVersion === session.currentUserSecurityVersion
  )
}

export function shouldRefreshSessionActivity(
  lastActiveAt: Date,
  now = new Date()
): boolean {
  return (
    now.getTime() - lastActiveAt.getTime() >= SESSION_ACTIVITY_WRITE_INTERVAL_MS
  )
}
