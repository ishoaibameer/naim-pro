// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "./session-policy"
import { getSessionCookieName } from "./cookie.server"

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

describe("production session policy", () => {
  it("uses the host-only production cookie and required lifetimes", () => {
    process.env.NODE_ENV = "production"
    expect(getSessionCookieName()).toBe("__Host-naim_session")
    expect(SESSION_ABSOLUTE_LIFETIME_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(24 * 60 * 60 * 1000)
  })

  it("keeps Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain attribute", () => {
    const source = readFileSync(
      fileURLToPath(new URL("cookie.server.ts", import.meta.url)),
      "utf8"
    )
    expect(source).toContain("HttpOnly${secure}; SameSite=Lax; Path=/")
    expect(source).not.toContain("Domain=")
  })
})
