import { describe, expect, it } from "vitest"

import { hashPassword } from "./password.server"
import {
  GENERIC_CREDENTIAL_ERROR,
  verifyLoginCandidate,
} from "./authentication-policy.server"
import type { LoginCandidate } from "./authentication-policy.server"

async function candidate(
  overrides: Partial<LoginCandidate["user"]> = {},
  membershipOverrides: Partial<LoginCandidate["memberships"][number]> = {}
): Promise<LoginCandidate> {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      passwordHash: await hashPassword("valid password"),
      status: "ACTIVE",
      securityVersion: 1,
      ...overrides,
    },
    memberships: [
      {
        id: "membership-1",
        organizationId: "organization-1",
        role: "MEMBER",
        status: "ACTIVE",
        organizationStatus: "ACTIVE",
        ...membershipOverrides,
      },
    ],
  }
}

describe("password authentication policy", () => {
  it("accepts a correct password for an active identity", async () => {
    const result = await verifyLoginCandidate(
      await candidate(),
      "valid password"
    )
    expect(result.membership.id).toBe("membership-1")
  })

  it("uses the same generic failure for missing users and wrong passwords", async () => {
    await expect(verifyLoginCandidate(null, "valid password")).rejects.toThrow(
      GENERIC_CREDENTIAL_ERROR
    )
    await expect(
      verifyLoginCandidate(await candidate(), "wrong password")
    ).rejects.toThrow(GENERIC_CREDENTIAL_ERROR)
  })

  it("rejects inactive users and inactive memberships", async () => {
    await expect(
      verifyLoginCandidate(
        await candidate({ status: "INACTIVE" }),
        "valid password"
      )
    ).rejects.toThrow(GENERIC_CREDENTIAL_ERROR)
    await expect(
      verifyLoginCandidate(
        await candidate({}, { status: "INACTIVE" }),
        "valid password"
      )
    ).rejects.toThrow(GENERIC_CREDENTIAL_ERROR)
  })
})
