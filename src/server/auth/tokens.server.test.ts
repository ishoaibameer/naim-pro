import { describe, expect, it } from "vitest"

import { generateSessionToken, hashSessionToken } from "./tokens.server"

describe("opaque session tokens", () => {
  it("generates distinct tokens with at least 32 bytes of entropy", () => {
    const first = generateSessionToken()
    const second = generateSessionToken()

    expect(first).not.toBe(second)
    expect(Buffer.from(first, "base64url")).toHaveLength(32)
  })

  it("stores a deterministic hash rather than the raw token", () => {
    const token = generateSessionToken()
    const hash = hashSessionToken(token)

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain(token)
    expect(hashSessionToken(token)).toBe(hash)
  })
})
