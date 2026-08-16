import { describe, expect, it } from "vitest"

import {
  ARGON2ID_PARAMETERS,
  hashPassword,
  verifyPassword,
} from "./password.server"

describe("Argon2id password hashing", () => {
  it("verifies the correct password and rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple")

    await expect(
      verifyPassword(hash, "correct horse battery staple")
    ).resolves.toBe(true)
    await expect(verifyPassword(hash, "incorrect password")).resolves.toBe(
      false
    )
  })

  it("encodes the selected Argon2id parameters", async () => {
    const hash = await hashPassword("temporary password")

    expect(hash).toContain("$argon2id$")
    expect(hash).toContain(
      `m=${ARGON2ID_PARAMETERS.memoryCost},p=${ARGON2ID_PARAMETERS.parallelism},t=${ARGON2ID_PARAMETERS.timeCost}`
    )
  })

  it("enforces the minimum password length before hashing", async () => {
    await expect(hashPassword("too-short")).rejects.toThrow(
      "Password must contain between"
    )
  })
})
