import { describe, expect, it } from "vitest"

import { isSessionRecordValid } from "./session-policy"
import type { SessionRecordForValidation } from "./types"

const now = new Date("2026-08-16T12:00:00.000Z")

function validSession(
  overrides: Partial<SessionRecordForValidation> = {}
): SessionRecordForValidation {
  return {
    id: "session-id",
    expiresAt: new Date("2026-08-20T12:00:00.000Z"),
    lastActiveAt: new Date("2026-08-16T11:30:00.000Z"),
    revokedAt: null,
    userSecurityVersion: 1,
    currentUserSecurityVersion: 1,
    userStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    organizationStatus: "ACTIVE",
    ...overrides,
  }
}

describe("session validation policy", () => {
  it("accepts a current active session", () => {
    expect(isSessionRecordValid(validSession(), now)).toBe(true)
  })

  it("rejects expired and idle-expired sessions", () => {
    expect(
      isSessionRecordValid(
        validSession({ expiresAt: new Date("2026-08-16T12:00:00.000Z") }),
        now
      )
    ).toBe(false)
    expect(
      isSessionRecordValid(
        validSession({ lastActiveAt: new Date("2026-08-15T11:59:59.000Z") }),
        now
      )
    ).toBe(false)
  })

  it("rejects revoked sessions and invalidated security versions", () => {
    expect(
      isSessionRecordValid(validSession({ revokedAt: new Date() }), now)
    ).toBe(false)
    expect(
      isSessionRecordValid(validSession({ currentUserSecurityVersion: 2 }), now)
    ).toBe(false)
  })

  it("rejects inactive users and memberships", () => {
    expect(
      isSessionRecordValid(validSession({ userStatus: "INACTIVE" }), now)
    ).toBe(false)
    expect(
      isSessionRecordValid(
        validSession({ organizationStatus: "INACTIVE" }),
        now
      )
    ).toBe(false)
    expect(
      isSessionRecordValid(validSession({ membershipStatus: "INACTIVE" }), now)
    ).toBe(false)
  })
})
